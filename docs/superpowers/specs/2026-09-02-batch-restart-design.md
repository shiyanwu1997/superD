# 批量重启并行化设计（搜索筛选路径）

**日期：** 2026-09-02
**状态：** 已获用户批准

## 问题

ProgramsPage 搜索筛选后点"全部重启"，前端 `handleBatch` 对筛选结果逐个串行 `await restartProgram(p.id)`。10 个程序约需 30s+（每个 stop→1s→start 串行累加），用户体验差。

无搜索筛选时走后端 `restart-all`（Supervisor 原生 `stopAllProcesses` + `startAllProcesses`），本身已是批量，不受影响。

## 方案（用户选定：后端批量端点）

### 后端：`POST /api/programs/batch-restart`

Body: `{ programIds: ["8-worker", "8-web", ...] }`

- 权限：`verifyToken` + `requireScope('programs:write')`；逐个 `checkUserSpecificProgramPermission`，无权限的记入结果（success: false, 403），不中断整批
- 执行：校验通过的 programIds 用 `Promise.allSettled` **并行**调 `supervisorService.restartProcess(projectId, programName)`（复用现有单程序逻辑：stop→1s→start）
- 不做稳定轮询（区别于 restart-all 的 15s 等待），每个程序按 restartProcess 返回值记成败
- 响应：

```json
{
  "success": true,
  "results": [
    { "programId": "8-worker", "programName": "worker", "success": true, "message": "程序 worker 已成功重启" }
  ],
  "summary": { "total": 2, "succeeded": 1, "failed": 1 }
}
```

- 顶层 `success` = 全部执行完毕（HTTP 200），不代表每个程序都成功；程序级成败看 results
- programIds 为空数组 → 400

### 前端

- `api.js` 新增 `batchRestartPrograms(programIds)` → POST 上述端点
- `ProgramsPage.handleBatch` 筛选分支（`searchText` 非空）改为一次调 `batchRestartPrograms`；完成提示 `重启完成：成功 X / 失败 Y`，Y > 0 时 warning 并 console 记录失败明细
- 无搜索分支维持 `restart-all` 现状

### 测试

- 后端 Jest：并行执行（非串行）、无权限项跳过不炸批、部分失败 summary 正确、空数组 400
- 前端 vitest：筛选状态调批量 API、非筛选状态仍调 restart-all

## 范围外（YAGNI）

- 不给批量端点加 start/stop 变体（用户未要求）
- 不加表格勾选机制
- 不做稳定轮询等待
