#!/usr/bin/env python3
"""
测试脚本：验证日志获取是否存在重复或缺漏问题
功能：
1. 多次获取历史日志
2. 检查日志是否存在重复或缺漏
3. 验证偏移量计算的准确性
"""

import xmlrpc.client
import re
import urllib.parse

# Supervisor连接信息
SUPERVISOR_HOST = "lb-dhoa2qv6-huedfymo7wbtk2pa.clb.ap-singapore.tencentclb.com"
SUPERVISOR_PORT = 9000
SUPERVISOR_USER = "supervisor"
SUPERVISOR_PASS = "C*3#E^*Kz@ggUM!EDMBQUC@xhLWGuzGbF6$KG"
PROGRAM_NAME = "axdev_api_queue_market"

# 日志相关参数
MAX_LINES_PER_REQUEST = 50000  # 每次请求的最大字节数
TEST_ITERATIONS = 3  # 测试次数


def connect_supervisor():
    """连接Supervisor API"""
    try:
        # 正确编码URL
        encoded_pass = urllib.parse.quote(SUPERVISOR_PASS)
        url = f"http://{SUPERVISOR_USER}:{encoded_pass}@{SUPERVISOR_HOST}:{SUPERVISOR_PORT}/RPC2"
        
        proxy = xmlrpc.client.ServerProxy(url)
        # 测试连接
        proxy.supervisor.getAPIVersion()
        print("✅ 成功连接到Supervisor API")
        return proxy
    except Exception as e:
        print(f"❌ 连接Supervisor失败: {e}")
        return None


def get_logs(proxy, program_name, offset, length):
    """获取指定偏移量和长度的日志"""
    try:
        if offset < 0:
            # 获取最新日志
            result = proxy.supervisor.tailProcessStdoutLog(program_name, 0, length)
            logs = result[0]
            new_offset = result[1]
        else:
            # 获取历史日志
            logs = proxy.supervisor.readProcessStdoutLog(program_name, offset, length)
            new_offset = offset
        
        # 分割日志行为数组
        log_lines = [line.strip() for line in logs.strip().split('\n') if line.strip()]
        
        return log_lines, new_offset
    except Exception as e:
        print(f"❌ 获取日志失败: {e}")
        return [], offset


def check_duplicates(log_lists):
    """检查多个日志列表中是否存在重复日志"""
    print("\n🔍 检查日志重复问题:")
    print("-" * 60)
    
    # 合并所有日志行
    all_lines = []
    for i, log_list in enumerate(log_lists):
        all_lines.extend(log_list)
        print(f"   第{i+1}次获取: {len(log_list)} 行")
    
    # 检查重复
    unique_lines = set(all_lines)
    duplicate_count = len(all_lines) - len(unique_lines)
    
    if duplicate_count > 0:
        print(f"❌ 发现 {duplicate_count} 行重复日志")
        
        # 找出重复的行
        line_counts = {}
        for line in all_lines:
            line_counts[line] = line_counts.get(line, 0) + 1
        
        # 打印前10个重复行
        duplicates_found = 0
        for line, count in line_counts.items():
            if count > 1:
                print(f"   重复 {count} 次: {line[:100]}...")
                duplicates_found += 1
                if duplicates_found >= 10:
                    print("   ... 更多重复行省略 ...")
                    break
        
        return False
    else:
        print(f"✅ 未发现重复日志 (共 {len(all_lines)} 行，{len(unique_lines)} 行唯一)")
        return True


def check_gaps(log_lists):
    """检查日志是否存在时间顺序问题（可能表示缺漏）"""
    print("\n📊 检查日志时间顺序问题:")
    print("-" * 60)
    
    # 合并所有日志行
    all_lines = []
    for log_list in log_lists:
        all_lines.extend(log_list)
    
    if len(all_lines) < 2:
        print("   日志行太少，无法检查顺序")
        return True
    
    # 正则表达式：匹配日志时间戳
    time_pattern = re.compile(r'^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})')
    
    # 检查时间顺序
    prev_time = None
    out_of_order_count = 0
    
    for i, line in enumerate(all_lines):
        match = time_pattern.match(line)
        if match:
            current_time = match.group(1)
            
            if prev_time and current_time < prev_time:
                out_of_order_count += 1
                if out_of_order_count <= 5:  # 只打印前5个问题
                    print(f"   行 {i+1}: 时间顺序错误")
                    print(f"      当前时间: {current_time}")
                    print(f"      前一时间: {prev_time}")
                    print(f"      行内容: {line[:100]}...")
            
            prev_time = current_time
    
    if out_of_order_count > 0:
        print(f"❌ 发现 {out_of_order_count} 行时间顺序错误")
        print("   这可能表示日志存在缺漏或重复")
        return False
    else:
        print(f"✅ 所有日志按时间顺序正确排列")
        return True


def check_offset_consistency(proxy, program_name):
    """检查偏移量计算的一致性"""
    print("\n🎯 检查偏移量计算一致性:")
    print("-" * 60)
    
    # 1. 获取最新日志
    print("   1. 获取最新日志...")
    latest_logs, latest_offset = get_logs(proxy, program_name, -1, MAX_LINES_PER_REQUEST)
    print(f"      最新日志行数: {len(latest_logs)}")
    print(f"      最新偏移量: {latest_offset}")
    
    # 2. 获取历史日志
    print("   2. 获取历史日志...")
    historical_offset = latest_offset - MAX_LINES_PER_REQUEST
    historical_logs, new_offset = get_logs(proxy, program_name, historical_offset, MAX_LINES_PER_REQUEST)
    print(f"      历史日志行数: {len(historical_logs)}")
    print(f"      请求偏移量: {historical_offset}")
    print(f"      返回偏移量: {new_offset}")
    
    # 3. 检查偏移量是否一致
    if new_offset == historical_offset:
        print(f"      ✅ 偏移量一致")
    else:
        print(f"      ❌ 偏移量不一致: 请求 {historical_offset}, 返回 {new_offset}")
    
    # 4. 检查日志内容是否连续
    print("   3. 检查日志内容连续性...")
    
    # 合并日志
    all_logs = historical_logs + latest_logs
    
    # 检查是否存在连续的日志行
    consecutive_count = 0
    for i in range(1, len(all_logs)):
        prev_line = all_logs[i-1]
        curr_line = all_logs[i]
        
        # 简单检查：如果两行的时间戳相邻，认为是连续的
        prev_match = re.search(r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})', prev_line)
        curr_match = re.search(r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})', curr_line)
        
        if prev_match and curr_match:
            prev_time = prev_match.group(1)
            curr_time = curr_match.group(1)
            
            if prev_time == curr_time:
                consecutive_count += 1
    
    if consecutive_count > 0:
        print(f"      ✅ 发现 {consecutive_count} 组连续时间戳的日志行")
    else:
        print(f"      ⚠️  未发现连续时间戳的日志行")
    
    return True


def main():
    """主函数"""
    print("=" * 60)
    print("测试日志获取是否存在重复或缺漏")
    print("=" * 60)
    
    # 连接Supervisor
    proxy = connect_supervisor()
    if not proxy:
        return
    
    # 测试1: 多次获取日志，检查重复
    print("\n1. 多次获取日志，检查重复问题")
    print("-" * 40)
    
    # 获取最新日志
    latest_logs, latest_offset = get_logs(proxy, PROGRAM_NAME, -1, MAX_LINES_PER_REQUEST)
    log_lists = [latest_logs]
    
    # 多次获取历史日志
    current_offset = latest_offset
    for i in range(TEST_ITERATIONS):
        historical_offset = max(0, current_offset - MAX_LINES_PER_REQUEST)
        historical_logs, current_offset = get_logs(proxy, PROGRAM_NAME, historical_offset, MAX_LINES_PER_REQUEST)
        log_lists.append(historical_logs)
    
    # 检查重复
    check_duplicates(log_lists)
    
    # 测试2: 检查日志时间顺序
    print("\n2. 检查日志时间顺序")
    print("-" * 40)
    check_gaps(log_lists)
    
    # 测试3: 检查偏移量一致性
    print("\n3. 检查偏移量计算一致性")
    print("-" * 40)
    check_offset_consistency(proxy, PROGRAM_NAME)
    
    print("\n" + "=" * 60)
    print("测试完成")
    print("=" * 60)


if __name__ == "__main__":
    main()
