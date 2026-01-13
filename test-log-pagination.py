#!/usr/bin/env python3
"""
测试脚本：模拟前端日志分页加载功能
功能：
1. 连接Supervisor API获取最新100行日志
2. 模拟点击"继续查看历史日志"按钮，获取更多历史日志
3. 验证新旧日志合并的顺序是否正确
"""

import xmlrpc.client
import re
import time

# Supervisor连接信息
# 密码中的特殊字符需要URL编码
SUPERVISOR_URL = "http://supervisor:C%2A3%23E%5E%2AKz%40ggUM%21EDMBQUC%40xhLWGuzGbF6%24KG@lb-dhoa2qv6-huedfymo7wbtk2pa.clb.ap-singapore.tencentclb.com:9000/RPC2"
PROGRAM_NAME = "axdev_api_queue_market"

# 日志相关参数
PAGE_SIZE = 100  # 每页日志行数
MAX_LINES_PER_REQUEST = 50000  # 每次请求的最大字节数

def connect_supervisor():
    """连接Supervisor API"""
    try:
        proxy = xmlrpc.client.ServerProxy(SUPERVISOR_URL)
        # 测试连接
        proxy.supervisor.getAPIVersion()
        print("✅ 成功连接到Supervisor API")
        return proxy
    except Exception as e:
        print(f"❌ 连接Supervisor失败: {e}")
        return None

def get_latest_logs(proxy, program_name, lines=100):
    """获取最新的日志行（模拟前端初始加载）"""
    try:
        # 使用tailProcessStdoutLog从文件末尾获取日志
        # 参数：program_name, offset=0, length=MAX_LINES_PER_REQUEST
        result = proxy.supervisor.tailProcessStdoutLog(program_name, 0, MAX_LINES_PER_REQUEST)
        
        # 解析结果
        logs = result[0]
        new_offset = result[1]
        
        # 将日志按行分割
        log_lines = logs.strip().split('\n')
        
        # 只返回最后lines行
        latest_lines = log_lines[-lines:] if len(log_lines) > lines else log_lines
        
        print(f"✅ 获取到最新日志 {len(latest_lines)} 行")
        print(f"   最早时间: {latest_lines[0][:23] if latest_lines else 'N/A'}")
        print(f"   最晚时间: {latest_lines[-1][:23] if latest_lines else 'N/A'}")
        print(f"   新偏移量: {new_offset}")
        
        return latest_lines, new_offset
    except Exception as e:
        print(f"❌ 获取最新日志失败: {e}")
        return [], 0

def get_historical_logs(proxy, program_name, offset, lines=100):
    """获取历史日志（模拟点击"继续查看历史日志"）"""
    try:
        # 确保offset是整数
        offset = int(offset)
        
        # 使用readProcessStdoutLog获取历史日志
        # 参数：program_name, offset, length=MAX_LINES_PER_REQUEST
        # 从当前偏移量向前读取
        read_offset = max(0, offset - MAX_LINES_PER_REQUEST)
        result = proxy.supervisor.readProcessStdoutLog(program_name, read_offset, MAX_LINES_PER_REQUEST)
        
        # 解析结果（有些版本的Supervisor直接返回字符串，有些返回元组）
        if isinstance(result, tuple) and len(result) >= 2:
            logs = result[0]
            new_offset = result[1]
        else:
            logs = result
            new_offset = read_offset
        
        # 将日志按行分割并过滤空行
        log_lines = [line.strip() for line in logs.strip().split('\n') if line.strip()]
        
        print(f"✅ 获取到历史日志 {len(log_lines)} 行")
        print(f"   读取偏移量: {read_offset}")
        print(f"   新偏移量: {new_offset}")
        
        # 检查日志是否有效
        if log_lines:
            print(f"   最早时间: {log_lines[0][:23] if len(log_lines[0]) > 23 else log_lines[0][:50]}")
            print(f"   最晚时间: {log_lines[-1][:23] if len(log_lines[-1]) > 23 else log_lines[-1][:50]}")
        
        return log_lines, new_offset
    except Exception as e:
        print(f"❌ 获取历史日志失败: {e}")
        print(f"   当前offset类型: {type(offset)}, 值: {offset}")
        import traceback
        traceback.print_exc()
        return [], offset

def check_log_order(all_logs):
    """检查日志的时间顺序是否正确"""
    if len(all_logs) < 2:
        return True
    
    # 正则表达式：匹配日志时间戳 (YYYY-MM-DD HH:MM:SS.mmm)
    time_pattern = re.compile(r'^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})')
    
    for i in range(1, len(all_logs)):
        prev_line = all_logs[i-1]
        curr_line = all_logs[i]
        
        prev_match = time_pattern.match(prev_line)
        curr_match = time_pattern.match(curr_line)
        
        if prev_match and curr_match:
            prev_time = prev_match.group(1)
            curr_time = curr_match.group(1)
            
            if prev_time > curr_time:
                print(f"❌ 日志顺序错误！")
                print(f"   第{i}行时间: {curr_time}")
                print(f"   第{i-1}行时间: {prev_time}")
                print(f"   第{i-1}行内容: {prev_line[:100]}...")
                print(f"   第{i}行内容: {curr_line[:100]}...")
                return False
    
    print("✅ 所有日志按时间顺序正确排列")
    return True

def find_target_logs(all_logs, target_patterns):
    """查找目标日志行"""
    found_lines = []
    
    # 更灵活的搜索：忽略大小写，匹配部分时间戳
    flexible_patterns = [
        r'2026.*19:19:08.*McsQuote.*DONE',
        r'2026.*19:19:11.*McsQuote.*RUNNING',
        r'2026.*19:19:11.*McsQuote.*DONE'
    ]
    
    print(f"\n使用灵活模式搜索目标日志行:")
    
    for i, line in enumerate(all_logs):
        # 检查原始模式
        for pattern in target_patterns:
            if pattern in line:
                found_lines.append((i, line))
                print(f"✓ 行 {i}: {line[:150]}...")
                break
        
        # 如果没有找到，使用正则表达式检查灵活模式
        line_already_found = any(found_line[1] == line for found_line in found_lines)
        if not line_already_found:
            for flex_pattern in flexible_patterns:
                if re.search(flex_pattern, line, re.IGNORECASE):
                    found_lines.append((i, line))
                    print(f"✓ 行 {i}: {line[:150]}... (灵活匹配)")
                    break
    
    return found_lines

def main():
    """主函数"""
    print("=" * 60)
    print("测试日志分页加载功能")
    print("=" * 60)
    
    # 连接Supervisor
    proxy = connect_supervisor()
    if not proxy:
        return
    
    # 1. 获取最新100行日志（模拟初始加载）
    print("\n1. 获取最新100行日志（模拟前端初始加载）")
    print("-" * 40)
    latest_logs, current_offset = get_latest_logs(proxy, PROGRAM_NAME, 100)
    
    if not latest_logs:
        return
    
    # 2. 查找目标日志行
    target_patterns = [
        "2026-01-12 19:19:08 App\\Jobs\\McsQuote",
        "2026-01-12 19:19:11 App\\Jobs\\McsQuote"
    ]
    
    print("\n2. 检查最新日志中是否包含目标日志行")
    print("-" * 40)
    found_in_latest = find_target_logs(latest_logs, target_patterns)
    
    if found_in_latest:
        print(f"✅ 在最新日志中找到 {len(found_in_latest)} 个目标日志行:")
        for i, (line_num, line) in enumerate(found_in_latest):
            print(f"   {i+1}. 行 {line_num}: {line[:100]}...")
    else:
        print("❌ 未在最新日志中找到目标日志行")
    
    # 3. 模拟点击"继续查看历史日志"按钮
    print("\n3. 模拟点击'继续查看历史日志'按钮")
    print("-" * 40)
    historical_logs, new_offset = get_historical_logs(proxy, PROGRAM_NAME, current_offset, 100)
    
    if not historical_logs:
        print("❌ 未获取到历史日志")
    else:
        # 4. 合并日志
        all_logs = historical_logs + latest_logs
        print(f"\n4. 合并日志后总共有 {len(all_logs)} 行")
        print("-" * 40)
        print(f"   合并后最早时间: {all_logs[0][:23] if all_logs else 'N/A'}")
        print(f"   合并后最晚时间: {all_logs[-1][:23] if all_logs else 'N/A'}")
        
        # 5. 检查日志顺序
        check_log_order(all_logs)
        
        # 6. 在合并后的日志中查找目标行
        print("\n5. 检查合并后的日志中是否包含目标日志行")
        print("-" * 40)
        found_in_all = find_target_logs(all_logs, target_patterns)
        
        if found_in_all:
            print(f"✅ 在合并后的日志中找到 {len(found_in_all)} 个目标日志行:")
            for i, (line_num, line) in enumerate(found_in_all):
                print(f"   {i+1}. 行 {line_num}: {line[:120]}...")
        else:
            print("❌ 未在合并后的日志中找到目标日志行")
    
    # 7. 再次点击"继续查看历史日志"（获取更多历史日志直到找到目标）
    print("\n6. 连续获取更多历史日志（直到找到目标日志或达到5次）")
    print("-" * 40)
    
    # 初始化所有日志和当前偏移量
    all_logs = historical_logs + latest_logs
    current_offset = new_offset
    found_target = False
    
    # 连续获取5次历史日志
    for attempt in range(1, 6):
        print(f"\n📊 第 {attempt} 次获取历史日志:")
        print("-" * 30)
        
        # 获取更多历史日志（每次获取200行以提高效率）
        more_historical_logs, current_offset = get_historical_logs(proxy, PROGRAM_NAME, current_offset, 200)
        
        if more_historical_logs:
            # 合并到所有日志中
            all_logs = more_historical_logs + all_logs
            print(f"   累计日志行数: {len(all_logs)}")
            
            # 检查目标日志
            print(f"   检查目标日志行...")
            found_in_all = find_target_logs(all_logs, target_patterns)
            
            if found_in_all:
                print(f"✅ 成功找到 {len(found_in_all)} 个目标日志行！")
                print("\n🎯 找到的目标日志行:")
                for i, (line_num, line) in enumerate(found_in_all):
                    print(f"   {i+1}. 行 {line_num}: {line[:150]}")
                found_target = True
                break
            else:
                print(f"❌ 第 {attempt} 次获取后仍未找到目标日志行")
                print(f"   当前最早日志时间: {all_logs[0][:23] if all_logs[0] else 'N/A'}")
        else:
            print(f"❌ 第 {attempt} 次获取历史日志失败")
            break
    
    if not found_target:
        print(f"\n⚠️  经过多次尝试后仍未找到目标日志行")
        print(f"   累计检查日志行数: {len(all_logs)}")
        print(f"   覆盖时间范围: {all_logs[0][:23] if all_logs[0] else 'N/A'} 至 {all_logs[-1][:23] if all_logs[-1] else 'N/A'}")
        print("   可能原因:")
        print("   1. 目标日志行可能在更早的历史记录中")
        print("   2. 目标日志行可能不存在于当前程序日志中")
        print("   3. 日志格式可能与预期不同")
    
    print("\n" + "=" * 60)
    print("测试完成")
    print("=" * 60)

if __name__ == "__main__":
    main()
