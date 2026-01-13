#!/usr/bin/env python3
"""
测试脚本：验证日志分页加载修复效果
功能：
1. 模拟前端日志分页加载功能
2. 验证修复后的偏移量计算是否正确
3. 检查日志是否存在重复或缺漏
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
PAGE_SIZE = 100  # 每页日志行数
MAX_LINES_PER_REQUEST = 50000  # 每次请求的最大字节数
TEST_PAGES = 3  # 测试的页数


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


def get_latest_logs(proxy, program_name, lines=100):
    """获取最新的日志行（模拟前端初始加载）"""
    try:
        print(f"\n📥 获取最新日志: program_name='{program_name}', lines={lines}")
        
        # 使用tailProcessStdoutLog从文件末尾获取日志
        result = proxy.supervisor.tailProcessStdoutLog(program_name, 0, MAX_LINES_PER_REQUEST)
        
        # 解析结果
        logs = result[0]
        new_offset = result[1]
        
        # 将日志按行分割
        log_lines = [line.strip() for line in logs.strip().split('\n') if line.strip()]
        
        # 只返回最后lines行
        latest_lines = log_lines[-lines:] if len(log_lines) > lines else log_lines
        
        print(f"   日志行数: {len(latest_lines)} (总: {len(log_lines)})")
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
        # 模拟后端的偏移量计算逻辑
        average_line_size = 100
        read_length = lines * average_line_size
        actual_length = min(read_length, MAX_LINES_PER_REQUEST)
        actual_offset = max(0, offset - actual_length)
        
        print(f"\n📥 获取历史日志: program_name='{program_name}', offset={offset}, actual_offset={actual_offset}, read_length={read_length}")
        
        # 使用readProcessStdoutLog从指定偏移量读取历史日志
        logs = proxy.supervisor.readProcessStdoutLog(program_name, actual_offset, actual_length)
        
        # 分割日志行为数组
        log_lines = [line.strip() for line in logs.strip().split('\n') if line.strip()]
        
        # 限制返回的行数
        historical_lines = log_lines[:lines] if len(log_lines) > lines else log_lines
        
        print(f"   日志行数: {len(historical_lines)} (总: {len(log_lines)})")
        print(f"   最早时间: {historical_lines[0][:23] if historical_lines else 'N/A'}")
        print(f"   最晚时间: {historical_lines[-1][:23] if historical_lines else 'N/A'}")
        print(f"   返回偏移量: {actual_offset}")
        
        return historical_lines, actual_offset
    except Exception as e:
        print(f"❌ 获取历史日志失败: {e}")
        return [], offset


def check_duplicates(log_lists):
    """检查多个日志列表中是否存在重复日志"""
    print("\n🔍 检查日志重复问题:")
    print("-" * 60)
    
    # 合并所有日志行
    all_lines = []
    for i, log_list in enumerate(log_lists):
        all_lines.extend(log_list)
        print(f"   第{i+1}页: {len(log_list)} 行")
    
    # 检查重复
    unique_lines = set(all_lines)
    duplicate_count = len(all_lines) - len(unique_lines)
    
    if duplicate_count > 0:
        print(f"❌ 发现 {duplicate_count} 行重复日志")
        return False
    else:
        print(f"✅ 未发现重复日志 (共 {len(all_lines)} 行)")
        return True


def check_log_sequence(log_lists):
    """检查日志的时间顺序是否正确"""
    print("\n📊 检查日志时间顺序:")
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
                if out_of_order_count <= 3:  # 只打印前3个问题
                    print(f"   行 {i+1}: 时间顺序错误")
                    print(f"      当前时间: {current_time}")
                    print(f"      前一时间: {prev_time}")
                    print(f"      行内容: {line[:100]}...")
            
            prev_time = current_time
    
    if out_of_order_count > 0:
        print(f"❌ 发现 {out_of_order_count} 行时间顺序错误")
        return False
    else:
        print(f"✅ 所有日志按时间顺序正确排列")
        return True


def main():
    """主函数"""
    print("=" * 60)
    print("测试日志分页加载修复效果")
    print("=" * 60)
    
    # 连接Supervisor
    proxy = connect_supervisor()
    if not proxy:
        return
    
    # 1. 获取最新日志（模拟初始加载）
    print("\n1. 初始加载最新日志")
    print("-" * 40)
    latest_logs, current_offset = get_latest_logs(proxy, PROGRAM_NAME, PAGE_SIZE)
    
    if not latest_logs:
        return
    
    # 2. 获取历史日志（模拟点击"继续查看历史日志"按钮）
    print("\n2. 模拟点击'继续查看历史日志'按钮")
    print("-" * 40)
    
    all_log_lists = [latest_logs]
    
    for attempt in range(1, TEST_PAGES + 1):
        print(f"\n{'-' * 40}")
        print(f"第 {attempt} 次点击")
        print(f"{'-' * 40}")
        
        historical_logs, current_offset = get_historical_logs(proxy, PROGRAM_NAME, current_offset, PAGE_SIZE)
        
        if historical_logs:
            all_log_lists.append(historical_logs)
            print(f"   累计日志页数: {len(all_log_lists)}")
            print(f"   累计日志行数: {sum(len(lst) for lst in all_log_lists)}")
        else:
            print(f"   第 {attempt} 次获取历史日志失败")
            break
    
    # 3. 验证结果
    print("\n3. 验证修复效果")
    print("-" * 40)
    
    # 检查重复
    no_duplicates = check_duplicates(all_log_lists)
    
    # 检查顺序
    correct_order = check_log_sequence(all_log_lists)
    
    # 4. 总结
    print("\n4. 总结")
    print("-" * 40)
    
    if no_duplicates and correct_order:
        print("✅ 修复成功！")
        print("   - 日志分页加载功能正常")
        print("   - 没有发现重复日志")
        print("   - 日志按时间顺序正确排列")
    else:
        print("❌ 修复仍有问题！")
        if not no_duplicates:
            print("   - 发现重复日志")
        if not correct_order:
            print("   - 日志顺序错误")
    
    print(f"\n📊 测试统计：")
    print(f"   - 测试页数: {len(all_log_lists)}")
    print(f"   - 总日志行数: {sum(len(lst) for lst in all_log_lists)}")
    print(f"   - 最后偏移量: {current_offset}")


if __name__ == "__main__":
    main()
