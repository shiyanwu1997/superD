import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getAllUsers, createUser, deleteUser, updateUserRole, updateUserPassword, getUserProjectPermissions, setUserProjectPermission, removeUserProjectPermission } from '../utils/api';
import { getProjects } from '../utils/api';

const UsersPage = ({ isOpen, onClose }) => {
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', roleId: 2 });
  const [selectedProjects, setSelectedProjects] = useState([]);

  // 当角色变化时，如果是管理员，则默认选择所有项目
  useEffect(() => {
    if (newUser.roleId === 1 && projects.length > 0) {
      setSelectedProjects(projects.map(project => project.id));
    }
  }, [newUser.roleId, projects]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const { user } = useAuth();

  // 获取所有用户
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const data = await getAllUsers();
        setUsers(data);
      } catch (err) {
        console.error('获取用户列表失败:', err);
        setMessage('获取用户列表失败');
      } finally {
        setLoading(false);
      }
    };

    const fetchProjects = async () => {
      try {
        const data = await getProjects();
        setProjects(data);
      } catch (err) {
        console.error('获取项目列表失败:', err);
      }
    };

    fetchUsers();
    fetchProjects();
  }, []);

  // 当角色变化时，如果是管理员，则默认选择当前管理员所有的项目权限
  useEffect(() => {
    if (newUser.roleId === 1 && projects.length > 0) {
      // 管理员只能为新用户分配自己拥有的项目权限
      // 由于当前用户的项目权限已经通过getProjects()获取，这里直接使用projects数组
      // 因为getProjects()返回的是当前用户有权限的项目
      setSelectedProjects(projects.map(project => project.id));
    }
  }, [newUser.roleId, projects]);

  // 创建新用户
  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      // 验证选中的项目权限是否都是当前管理员拥有的
      // 由于projects数组只包含当前管理员有权限的项目，所以直接检查即可
      const invalidProjects = selectedProjects.filter(projectId => 
        !projects.some(p => p.id === projectId)
      );
      
      if (invalidProjects.length > 0) {
        setMessage('您没有权限分配项目ID为 ' + invalidProjects.join(', ') + ' 的权限');
        return;
      }
      
      const result = await createUser(newUser.username, newUser.password, newUser.roleId);
      if (result.success) {
        const newUserId = result.user.id;
        
        // 设置项目权限（包括管理员）
        // 先清除所有权限（如果有）
        // 然后添加选中的项目权限
        for (const projectId of selectedProjects) {
          await setUserProjectPermission(newUserId, projectId);
        }
        
        // 重新加载完整的用户列表，包含正确的权限信息
        const updatedUsers = await getAllUsers();
        setUsers(updatedUsers);
        
        // 重置表单
        setNewUser({ username: '', password: '', roleId: 2 });
        setSelectedProjects([]);
        setShowCreateForm(false);
        setMessage('用户创建成功');
      }
    } catch (err) {
      console.error('创建用户失败:', err);
      setMessage('创建用户失败: ' + (err.response?.data?.message || err.message));
    }
  };

  // 删除用户
  const handleDeleteUser = async (userId) => {
    const userToDelete = users.find(user => user.id === userId);
    if (userToDelete.username === 'admin') {
      setMessage('admin用户不可删除');
      return;
    }
    if (!window.confirm('确定要删除这个用户吗？')) return;
    try {
      const result = await deleteUser(userId);
      if (result.success) {
        setUsers(users.filter(user => user.id !== userId));
        setMessage('用户删除成功');
      }
    } catch (err) {
      console.error('删除用户失败:', err);
      setMessage('删除用户失败: ' + (err.response?.data?.message || err.message));
    }
  };

  // 更新用户角色
  const handleUpdateRole = async (userId, roleId) => {
    try {
      const result = await updateUserRole(userId, roleId);
      if (result.success) {
        setUsers(users.map(user => 
          user.id === userId ? { ...user, roleId } : user
        ));
        setMessage('用户角色更新成功');
      }
    } catch (err) {
      console.error('更新用户角色失败:', err);
      setMessage('更新用户角色失败: ' + (err.response?.data?.message || err.message));
    }
  };

  // 更新用户密码
  const handleUpdatePassword = async (userId) => {
    if (!newPassword) {
      setMessage('请输入新密码');
      return;
    }
    try {
      const result = await updateUserPassword(userId, newPassword);
      if (result.success) {
        setMessage('密码更新成功');
        setShowEditPassword(false);
        setNewPassword('');
      }
    } catch (err) {
      console.error('更新密码失败:', err);
      setMessage('更新密码失败: ' + (err.response?.data?.message || err.message));
    }
  };

  // 切换项目权限
  const toggleProjectPermission = async (userId, projectId) => {
    try {
      // 获取要修改的用户信息
      const targetUser = users.find(u => u.id === userId);
      
      // 检查当前用户是否为普通管理员，并且要修改的用户是管理员
      // 普通管理员只能管理普通用户的项目权限
      if (user.username !== 'admin' && targetUser.roleId === 1) {
        setMessage('普通管理员不能修改其他管理员的项目权限');
        return;
      }
      
      // 检查当前管理员是否有该项目的权限
      // 管理员只能为用户分配自己拥有的项目权限
      // 由于projects数组只包含当前管理员有权限的项目，所以直接检查即可
      const hasAdminPermission = projects.some(p => p.id === projectId);
      if (!hasAdminPermission) {
        setMessage('您没有权限操作此项目');
        return;
      }
      
      const userPermissions = await getUserProjectPermissions(userId);
      const hasPermission = userPermissions.some(perm => perm.projectId === projectId);
      
      if (hasPermission) {
        await removeUserProjectPermission(userId, projectId);
        setMessage('项目权限已移除');
      } else {
        await setUserProjectPermission(userId, projectId);
        setMessage('项目权限已添加');
      }
      
      // 重新加载用户列表以更新权限信息
      const updatedUsers = await getAllUsers();
      setUsers(updatedUsers);
    } catch (err) {
      console.error('更新项目权限失败:', err);
      setMessage('更新项目权限失败: ' + (err.response?.data?.message || err.message));
    }
  };

  return isOpen ? (
    <>
      <div className="modal-overlay">
        <div className="modal-content users-modal-content">
          <div className="modal-header">
            <h2>用户管理</h2>
            <button 
              className="modal-close" 
              onClick={onClose}
            >
              ×
            </button>
          </div>
          <div className="modal-body">
            <div className="users-content">
              <div className="users-header">
                <button 
                  className="btn btn-primary create-user-btn" 
                  onClick={() => setShowCreateForm(!showCreateForm)}
                >
                  {showCreateForm ? '取消' : '创建用户'}
                </button>
              </div>

              {message && <div className={`message ${message.includes('失败') ? 'error' : 'success'}`}>{message}</div>}

              {showCreateForm && (
                <div className="create-user-form-container">
                  <div className="create-user-form card">
                    <div className="form-header">
                      <h3>创建新用户</h3>
                    </div>
                    <form onSubmit={handleCreateUser} className="user-form">
                      <div className="form-content">
                        <div className="form-group">
                          <label className="form-label">用户名</label>
                          <input 
                            type="text" 
                            value={newUser.username} 
                            onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} 
                            required
                            placeholder="请输入用户名"
                            className="form-input"
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">密码</label>
                          <input 
                            type="password" 
                            value={newUser.password} 
                            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} 
                            required
                            placeholder="请输入密码"
                            className="form-input"
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">角色</label>
                          <select 
                            value={newUser.roleId} 
                            onChange={(e) => setNewUser({ ...newUser, roleId: parseInt(e.target.value)})}
                            className="form-select"
                            disabled={user.username !== 'admin' && newUser.roleId === 1} // 普通管理员不能选择管理员角色
                          >
                            <option value={1} disabled={user.username !== 'admin'}>管理员</option>
                            <option value={2}>开发者</option>
                          </select>
                        </div>
                        {newUser.roleId !== 1 && (
                          <div className="form-group">
                            <label className="form-label">项目权限</label>
                            <div className="project-selection tags-container">
                              {projects.map(project => (
                                <div 
                                  key={project.id} 
                                  className={`project-checkbox tag-item ${selectedProjects.includes(project.id) ? 'selected' : ''}`}
                                  onClick={() => {
                                    if (selectedProjects.includes(project.id)) {
                                      setSelectedProjects(selectedProjects.filter(id => id !== project.id));
                                    } else {
                                      setSelectedProjects([...selectedProjects, project.id]);
                                    }
                                  }}
                                >
                                  <input 
                                    type="checkbox" 
                                    checked={selectedProjects.includes(project.id)} 
                                    onChange={() => {}}
                                    style={{ display: 'none' }}
                                  />
                                  <span className="project-name">{project.name}</span>
                                </div>
                              ))}
                              {projects.length === 0 && (
                                <div className="no-projects">
                                  <span>没有可分配的项目权限</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        {newUser.roleId === 1 && (
                          <div className="form-group">
                            <label className="form-label">项目权限</label>
                            <div className="admin-permission-note alert alert-info">
                              管理员默认拥有所有项目权限，无需分配
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="form-actions">
                        <button 
                          type="button" 
                          className="btn btn-secondary"
                          onClick={() => setShowCreateForm(false)}
                        >
                          取消
                        </button>
                        <button type="submit" className="btn btn-primary">
                          创建用户
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="loading">加载中...</div>
              ) : (
                <div className="users-table-container">
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>用户名</th>
                        <th>角色</th>
                        <th>项目权限</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(currentUser => (
                        <tr key={currentUser.id}>
                          <td>{currentUser.id}</td>
                          <td>{currentUser.username}</td>
                          <td>
                            <select 
                              value={currentUser.roleId} 
                              onChange={(e) => handleUpdateRole(currentUser.id, parseInt(e.target.value))}
                              disabled={
                                currentUser.username === 'admin' || // admin用户不能修改
                                (currentUser.id === user.id && currentUser.roleId === 1) || // 不能修改自己为普通用户
                                (user.username !== 'admin' && currentUser.roleId === 1) // 普通管理员不能修改管理员角色
                              }
                              className="role-select"
                            >
                              <option value={1}>管理员</option>
                              <option value={2}>开发者</option>
                            </select>
                          </td>
                          <td>
                            <div className="project-permissions">
                              {projects.map(project => {
                                const hasPermission = currentUser.projectPermissions?.some(perm => perm.projectId === project.id) || false;
                                // admin用户的项目权限不可修改
                                const isAdminUser = currentUser.username === 'admin';
                                // 只有admin可以管理其他管理员的权限
                                const canManagePermission = user.username === 'admin' && !isAdminUser || (currentUser.roleId !== 1 && !isAdminUser);
                                return (
                                  <div 
                                    key={project.id} 
                                    className={`permission-tag ${hasPermission ? 'active' : ''} ${!canManagePermission ? 'disabled' : ''}`}
                                    onClick={() => canManagePermission && toggleProjectPermission(currentUser.id, project.id)}
                                    title={!canManagePermission ? '无法修改此权限' : hasPermission ? '移除权限' : '添加权限'}
                                  >
                                    {project.name}
                                  </div>
                                );
                              })}
                              {projects.length === 0 && (
                                <div className="no-permissions">
                                  <span>没有可分配的项目权限</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="action-buttons">
                              <button 
                                className="btn btn-secondary edit-btn" 
                                onClick={() => {
                                  setSelectedUser(currentUser);
                                  setShowEditPassword(true);
                                }}
                              >
                                修改密码
                              </button>
                              <button 
                                className="btn btn-danger delete-btn" 
                                onClick={() => handleDeleteUser(currentUser.id)}
                                disabled={currentUser.username === 'admin'} // 不能删除admin用户
                              >
                                删除
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* 修改密码模态框 - 独立于主模态框 */}
      {showEditPassword && selectedUser && (
        <div className="modal-overlay">
          <div className="modal-content edit-password-modal">
            <div className="modal-header">
              <h3>修改用户 {selectedUser.username} 的密码</h3>
              <button 
                className="modal-close" 
                onClick={() => {
                  setShowEditPassword(false);
                  setNewPassword('');
                }}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">新密码</label>
                <input 
                  type="password" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="form-input"
                  placeholder="请输入新密码"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  setShowEditPassword(false);
                  setNewPassword('');
                }}
              >
                取消
              </button>
              <button 
                className="btn btn-primary" 
                onClick={() => handleUpdatePassword(selectedUser.id)}
                disabled={!newPassword}
              >
                确认修改
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  ) : null;
};

export default UsersPage;