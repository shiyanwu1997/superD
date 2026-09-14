/**
 * 解析动态生成的程序ID (格式: ${projectId}-${programName})
 * @param {string} programId - 程序ID
 * @returns {{ projectId: number, programName: string }}
 * @throws {Error} 如果ID格式无效
 */
function parseProgramId(programId) {
  const firstDashIndex = programId.indexOf('-');
  if (firstDashIndex === -1) {
    throw new Error('无效的程序ID格式');
  }
  const projectIdStr = programId.substring(0, firstDashIndex);
  const programName = programId.substring(firstDashIndex + 1);

  if (!projectIdStr || !programName) {
    throw new Error('无效的程序ID格式');
  }

  const projectId = parseInt(projectIdStr);
  if (isNaN(projectId)) {
    throw new Error('无效的程序ID格式');
  }

  return { projectId, programName };
}

module.exports = { parseProgramId };
