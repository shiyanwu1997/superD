import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getProgramsByProject, startProgram, stopProgram, restartProgram, getProjects, startAllPrograms, stopAllPrograms, restartAllPrograms, changeOwnPassword, createProject, updateProject, deleteProject } from '../utils/api';
import UsersPage from './UsersPage';
import ProgramDetailPage from './ProgramDetailPage';

const ProgramsPage = () => {
  const { projectId } = useParams();
  const [programs, setPrograms] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [message, setMessage] = useState('');
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');

  const [editingProject, setEditingProject] = useState(null);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectHost, setProjectHost] = useState('');
  const [projectPort, setProjectPort] = useState('');
  const [projectUsername, setProjectUsername] = useState('');
  const [projectPassword, setProjectPassword] = useState('');
  const [createProjectMessage, setCreateProjectMessage] = useState('');
  const [editProjectMessage, setEditProjectMessage] = useState('');
  const [showProjectManageModal, setShowProjectManageModal] = useState(false);
  const [activeTab, setActiveTab] = useState('list'); // 'list', 'add', 'edit'
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [showProgramDetailModal, setShowProgramDetailModal] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  // 请求取消token引用，用于取消未完成的请求
  const cancelTokenRef = useRef(null);

  // 获取项目下的程序列表
  useEffect(() => {
    const fetchPrograms = async () => {
      // 只有当projectId存在时才获取程序列表
      if (!projectId) {
        return;
      }
      
      // 取消之前未完成的请求
      if (cancelTokenRef.current) {
        cancelTokenRef.current.cancel('取消旧请求，准备发起新请求');
      }
      
      // 创建新的取消token
      const source = axios.CancelToken.source();
      cancelTokenRef.current = source;
      
      try {
        setLoading(true);
        // 切换项目时立即重置所有相关状态，确保没有旧消息残留
        setPrograms([]);
        setMessage('');
        console.log(`开始获取项目 ${projectId} 的程序列表`);
        const data = await getProgramsByProject(projectId, { cancelToken: source.token });
        console.log(`获取项目 ${projectId} 的程序列表成功:`, data);
        setPrograms(data);
      } catch (err) {
        // 如果是用户取消请求，不显示错误消息
        if (axios.isCancel(err)) {
          console.log(`请求被取消: ${err.message}`);
          return;
        }
        
        console.error(`获取项目 ${projectId} 的程序列表失败:`, err);
        // 显示具体的错误信息，而不仅仅是通用消息
        // 确保错误信息不重复
        let errorMsg = err.response?.data?.error || err.message || '获取程序列表失败';
        // 如果错误信息已经包含前缀，不再重复添加
        if (errorMsg.startsWith('获取程序列表失败:')) {
          errorMsg = errorMsg.replace('获取程序列表失败:', '');
        }
        setMessage(errorMsg);
        // 出错时确保程序列表为空
        setPrograms([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPrograms();
    
    // 组件卸载时取消请求
    return () => {
      if (cancelTokenRef.current) {
        cancelTokenRef.current.cancel('组件卸载，取消请求');
      }
    };
  }, [projectId]);

  // 获取用户可访问的项目列表
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoadingProjects(true);
        const data = await getProjects();
        setProjects(data);
      } catch (err) {
        console.error(err);
        setMessage('获取项目列表失败');
      } finally {
        setLoadingProjects(false);
      }
    };

    fetchProjects();
  }, [projectId]);



  // 默认选择第一个项目
  useEffect(() => {
    if (!loadingProjects && projects.length > 0) {
      // 如果没有projectId或者projectId不存在于用户的项目列表中
      if (!projectId || !projects.some(p => p.id === parseInt(projectId))) {
        navigate(`/programs/${projects[0].id}`);
      }
    }
  }, [projects, loadingProjects, projectId, navigate]);



  // 处理程序操作
  const handleProgramAction = async (programId, action) => {
    try {
      let response;
      switch (action) {
        case 'start':
          response = await startProgram(programId);
          break;
        case 'stop':
          response = await stopProgram(programId);
          break;
        case 'restart':
          response = await restartProgram(programId);
          break;
        default:
          return;
      }

      if (response.success) {
        setMessage(response.message);
        // 刷新程序列表以获取最新状态
        const data = await getProgramsByProject(projectId);
        setPrograms(data);
      } else {
        setMessage(response.message || '操作失败');
      }
    } catch (err) {
      console.error(err);
      setMessage('操作失败');
    }

    // 3秒后清除消息
    setTimeout(() => setMessage(''), 3000);
  };

  // 处理批量操作
  const handleBatchAction = async (action) => {
    try {
      let response;
      switch (action) {
        case 'start-all':
          response = await startAllPrograms(projectId);
          break;
        case 'stop-all':
          response = await stopAllPrograms(projectId);
          break;
        case 'restart-all':
          response = await restartAllPrograms(projectId);
          break;
        default:
          return;
      }

      if (response.success) {
        setMessage(response.message);
        // 刷新程序列表以获取最新状态
        const data = await getProgramsByProject(projectId);
        setPrograms(data);
      } else {
        setMessage(response.message || '批量操作失败');
      }
    } catch (err) {
      console.error(err);
      setMessage('批量操作失败');
    }

    // 3秒后清除消息
    setTimeout(() => setMessage(''), 3000);
  };

  const handleChangePassword = async () => {
    // 验证新密码和确认密码是否一致
    if (newPassword !== confirmPassword) {
      setPasswordMessage('新密码和确认密码不一致');
      return;
    }
    
    try {
      const result = await changeOwnPassword(oldPassword, newPassword);
      if (result.success) {
        setPasswordMessage('密码修改成功');
        // 重置表单并关闭模态框
        setTimeout(() => {
          setShowChangePasswordModal(false);
          setOldPassword('');
          setNewPassword('');
          setConfirmPassword('');
          setPasswordMessage('');
        }, 1500);
      } else {
        setPasswordMessage(result.error || '密码修改失败');
      }
    } catch (err) {
      console.error('密码修改失败:', err);
      setPasswordMessage('密码修改失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleCreateProject = async () => {
    // 验证必填字段
    if (!projectName || !projectHost || !projectPort) {
      setCreateProjectMessage('项目名称、主机和端口不能为空');
      return;
    }
    
    try {
      const projectData = {
        name: projectName,
        description: projectDescription,
        host: projectHost,
        port: projectPort,
        username: projectUsername,
        password: projectPassword
      };
      
      const result = await createProject(projectData);
      if (result) {
        setCreateProjectMessage('项目创建成功');
        // 刷新项目列表
        const data = await getProjects();
        setProjects(data);
        // 重置表单
        setTimeout(() => {
          setProjectName('');
          setProjectDescription('');
          setProjectHost('');
          setProjectPort('');
          setProjectUsername('');
          setProjectPassword('');
          setCreateProjectMessage('');
          setActiveTab('list');
        }, 1500);
      } else {
        setCreateProjectMessage('项目创建失败');
      }
    } catch (err) {
      console.error('项目创建失败:', err);
      setCreateProjectMessage('项目创建失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleEditProject = async () => {
    // 验证必填字段
    if (!projectName || !projectHost || !projectPort) {
      setEditProjectMessage('项目名称、主机和端口不能为空');
      return;
    }
    
    try {
      const projectData = {
        name: projectName,
        description: projectDescription,
        host: projectHost,
        port: projectPort,
        username: projectUsername,
        password: projectPassword
      };
      
      const result = await updateProject(editingProject.id, projectData);
      if (result) {
        setEditProjectMessage('项目更新成功');
        // 刷新项目列表
        const data = await getProjects();
        setProjects(data);
        // 重置表单并切换到项目列表标签
        setTimeout(() => {
          setEditingProject(null);
          setProjectName('');
          setProjectDescription('');
          setProjectHost('');
          setProjectPort('');
          setProjectUsername('');
          setProjectPassword('');
          setEditProjectMessage('');
          setActiveTab('list');
        }, 1500);
      } else {
        setEditProjectMessage('项目更新失败');
      }
    } catch (err) {
      console.error('项目更新失败:', err);
      setEditProjectMessage('项目更新失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteProject = async (deletedProjectId) => {
    try {
      const result = await deleteProject(deletedProjectId);
      if (result) {
        setMessage('项目删除成功');
        // 刷新项目列表
        const data = await getProjects();
        setProjects(data);
        // 如果当前正在查看的项目被删除，则导航到第一个项目
        if (data.length > 0 && parseInt(deletedProjectId) === parseInt(projectId)) {
          navigate(`/programs/${data[0].id}`);
        }
      } else {
        setMessage('项目删除失败');
      }
    } catch (err) {
      console.error('项目删除失败:', err);
      setMessage('项目删除失败: ' + (err.response?.data?.error || err.message));
    }
    
    // 3秒后清除消息
    setTimeout(() => setMessage(''), 3000);
  };

if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Supervisor</h1>
        <div className="user-info">
          <div className="user-details">
            <span>欢迎, {user?.username || ''}</span>
            {user && user.roleId === 1 && (
              <button 
                className="nav-link-btn" 
                onClick={() => setShowUsersModal(true)}
              >
                用户管理
              </button>
            )}
            {user && user.roleId !== 1 && (
              <button className="change-password-button" onClick={() => {
                console.log('修改密码按钮被点击');
                setShowChangePasswordModal(true);
                console.log('showChangePasswordModal状态:', true);
              }}>
                修改密码
              </button>
            )}
          </div>
          <button className="logout-button" onClick={logout}>退出</button>
        </div>
      </header>

      <main className="main-content">
        {/* 左侧项目选择栏 */}
        <div className="project-sidebar">
          <h2 className="sidebar-title">项目列表</h2>
          <div className="project-actions">
            {user && user.roleId === 1 && (
              <button 
                className="add-project-button"
                onClick={() => setShowProjectManageModal(true)}
              >
                项目编辑
              </button>
            )}
          </div>
          {loadingProjects ? (
            <div className="sidebar-loading">加载中...</div>
          ) : (
            <ul className="project-list">
              {projects.map((project) => (
                <li 
                  key={project.id}
                  className={`project-item ${project.id === parseInt(projectId) ? 'active' : ''}`}
                  onClick={() => navigate(`/programs/${project.id}`)}
                >
                  <div className="project-header">
                    <div className="project-name">{project.name}</div>
                    <div className="project-controls">
                      <div className="connection-status">
                        <span className={`status-light ${project.connectionStatus?.connected ? 'success' : 'failure'}`}></span>
                      </div>
                    </div>
                  </div>
                  <div className="project-description">{project.description}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 右侧程序列表 */}
        <div className="programs-content">
          <div className="page-header">
            <h2>程序列表</h2>
            <div className="batch-actions">
              <button 
                className="control-button start-all"
                onClick={() => handleBatchAction('start-all')}
              >
                启动所有程序
              </button>
              <button 
                className="control-button stop-all"
                onClick={() => handleBatchAction('stop-all')}
              >
                停止所有程序
              </button>
              <button 
                className="control-button restart-all"
                onClick={() => handleBatchAction('restart-all')}
              >
                重启所有程序
              </button>
            </div>
          </div>

          {message && (
            <div className={`message ${message.includes('失败') || message.includes('无法连接') ? 'error-message' : 'success-message'}`}>
              {message}
            </div>
          )}

          {loading ? (
            <div className="loading">加载中...</div>
          ) : (
            <div className="programs-table-container">
              <table className="programs-table">
                <thead>
                  <tr>
                    <th>程序名称</th>
                    <th>描述</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {programs.map((program) => (
                    <tr key={program.id}>
                      <td>{program.name}</td>
                      <td>{program.description}</td>
                      <td>
                        <span className={`status-badge ${program.status.toLowerCase()}`}>
                          {program.status}
                        </span>
                      </td>
                      <td className="action-buttons">
                        <button 
                          className="detail-button"
                          onClick={() => {
                            setSelectedProgramId(program.id);
                            setShowProgramDetailModal(true);
                          }}
                        >
                          详情
                        </button>
                        <button 
                          className="control-button start"
                          onClick={() => handleProgramAction(program.id, 'start')}
                        >
                          启动
                        </button>
                        <button 
                          className="control-button stop"
                          onClick={() => handleProgramAction(program.id, 'stop')}
                        >
                          停止
                        </button>
                        <button 
                          className="control-button restart"
                          onClick={() => handleProgramAction(program.id, 'restart')}
                        >
                          重启
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {programs.length === 0 && (
                <div className="no-programs">
                  <div className="no-programs-icon">📋</div>
                  <h3>暂无程序</h3>
                  <p>该项目下没有可访问的Supervisor程序</p>
                  <p className="no-programs-hint">请确保Supervisor已正确配置并运行</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* 密码修改模态框 */}
      {showChangePasswordModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>修改密码</h3>
              <button 
                className="modal-close" 
                onClick={() => {
                  setShowChangePasswordModal(false);
                  setOldPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setPasswordMessage('');
                }}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              {passwordMessage && (
                <div className={`password-message ${passwordMessage.includes('失败') || passwordMessage.includes('不一致') ? 'error' : 'success'}`}>
                  {passwordMessage}
                </div>
              )}
              
              <div className="form-group">
                <label>原密码</label>
                <input 
                  type="password" 
                  value={oldPassword} 
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="请输入原密码"
                  required
                />
              </div>
              
              <div className="form-group">
                <label>新密码</label>
                <input 
                  type="password" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="请输入新密码"
                  required
                />
              </div>
              
              <div className="form-group">
                <label>确认新密码</label>
                <input 
                  type="password" 
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="请再次输入新密码"
                  required
                />
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                className="cancel-button" 
                onClick={() => {
                  setShowChangePasswordModal(false);
                  setOldPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setPasswordMessage('');
                }}
              >
                取消
              </button>
              <button 
                className="confirm-button" 
                onClick={handleChangePassword}
              >
                确认修改
              </button>
            </div>
          </div>
        </div>
      )}



      {/* 项目管理模态框 */}
      {showProjectManageModal && (
        <div className="modal-overlay">
          <div className="modal-content project-management-modal">
            <div className="modal-header">
              <h3>项目管理</h3>
              <button 
                className="modal-close" 
                onClick={() => {
                  setShowProjectManageModal(false);
                  setActiveTab('list');
                  setEditingProject(null);
                  setProjectName('');
                  setProjectDescription('');
                  setProjectHost('');
                  setProjectPort('');
                  setProjectUsername('');
                  setProjectPassword('');
                  setCreateProjectMessage('');
                  setEditProjectMessage('');
                }}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              {/* 标签切换 */}
              <div className="modal-tabs">
                <button 
                  className={`tab-button ${activeTab === 'list' ? 'active' : ''}`}
                  onClick={() => setActiveTab('list')}
                >
                  项目列表
                </button>
                <button 
                  className={`tab-button ${activeTab === 'add' ? 'active' : ''}`}
                  onClick={() => setActiveTab('add')}
                >
                  添加项目
                </button>
              </div>
              
              {/* 项目列表标签 */}
              {activeTab === 'list' && (
                <div className="project-list-tab">
                  <table className="projects-table">
                    <thead>
                      <tr>
                        <th>项目名称</th>
                        <th>描述</th>
                        <th>主机</th>
                        <th>端口</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projects.map((project) => (
                        <tr key={project.id}>
                          <td>{project.name}</td>
                          <td>{project.description || '-'}</td>
                          <td>{project.supervisorConfig?.host}</td>
                          <td>{project.supervisorConfig?.port}</td>
                          <td>
                            <button 
                              className="edit-button"
                              onClick={() => {
                                setEditingProject(project);
                                setProjectName(project.name || '');
                                setProjectDescription(project.description || '');
                                setProjectHost(project.supervisorConfig?.host || '');
                                setProjectPort((project.supervisorConfig?.port || '').toString());
                                setProjectUsername(project.supervisorConfig?.username || '');
                                setProjectPassword(project.supervisorConfig?.password || '');
                                setActiveTab('edit');
                              }}
                            >
                              编辑
                            </button>
                            <button 
                              className="delete-button"
                              onClick={() => {
                                if (window.confirm(`确定要删除项目 ${project.name} 吗？`)) {
                                  handleDeleteProject(project.id);
                                }
                              }}
                            >
                              删除
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              
              {/* 添加项目标签 */}
              {activeTab === 'add' && (
                <div className="add-project-tab">
                  {createProjectMessage && (
                    <div className={`create-project-message ${createProjectMessage.includes('失败') ? 'error' : 'success'}`}>
                      {createProjectMessage}
                    </div>
                  )}
                  
                  <div className="form-group">
                    <label>项目名称</label>
                    <input 
                      type="text" 
                      value={projectName} 
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="请输入项目名称"
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>项目描述</label>
                    <textarea 
                      value={projectDescription} 
                      onChange={(e) => setProjectDescription(e.target.value)}
                      placeholder="请输入项目描述（可选）"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>主机地址</label>
                    <input 
                      type="text" 
                      value={projectHost} 
                      onChange={(e) => setProjectHost(e.target.value)}
                      placeholder="请输入主机地址"
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>端口</label>
                    <input 
                      type="number" 
                      value={projectPort} 
                      onChange={(e) => setProjectPort(e.target.value)}
                      placeholder="请输入端口"
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>用户名（可选）</label>
                    <input 
                      type="text" 
                      value={projectUsername} 
                      onChange={(e) => setProjectUsername(e.target.value)}
                      placeholder="请输入用户名"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>密码（可选）</label>
                    <input 
                      type="password" 
                      value={projectPassword} 
                      onChange={(e) => setProjectPassword(e.target.value)}
                      placeholder="请输入密码"
                    />
                  </div>
                </div>
              )}
              
              {/* 编辑项目标签 */}
              {activeTab === 'edit' && editingProject && (
                <div className="edit-project-tab">
                  {editProjectMessage && (
                    <div className={`edit-project-message ${editProjectMessage.includes('失败') ? 'error' : 'success'}`}>
                      {editProjectMessage}
                    </div>
                  )}
                  
                  <div className="form-group">
                    <label>项目名称</label>
                    <input 
                      type="text" 
                      value={projectName} 
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="请输入项目名称"
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>项目描述</label>
                    <textarea 
                      value={projectDescription} 
                      onChange={(e) => setProjectDescription(e.target.value)}
                      placeholder="请输入项目描述（可选）"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>主机地址</label>
                    <input 
                      type="text" 
                      value={projectHost} 
                      onChange={(e) => setProjectHost(e.target.value)}
                      placeholder="请输入主机地址"
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>端口</label>
                    <input 
                      type="number" 
                      value={projectPort} 
                      onChange={(e) => setProjectPort(e.target.value)}
                      placeholder="请输入端口"
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>用户名（可选）</label>
                    <input 
                      type="text" 
                      value={projectUsername} 
                      onChange={(e) => setProjectUsername(e.target.value)}
                      placeholder="请输入用户名"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>密码（可选）</label>
                    <input 
                      type="password" 
                      value={projectPassword} 
                      onChange={(e) => setProjectPassword(e.target.value)}
                      placeholder="请输入密码"
                    />
                  </div>
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              {activeTab === 'list' && (
                <button 
                  className="confirm-button" 
                  onClick={() => setActiveTab('add')}
                >
                  添加项目
                </button>
              )}
              
              {activeTab === 'add' && (
                <>
                  <button 
                    className="cancel-button" 
                    onClick={() => setActiveTab('list')}
                  >
                    取消
                  </button>
                  <button 
                    className="confirm-button" 
                    onClick={handleCreateProject}
                  >
                    确认创建
                  </button>
                </>
              )}
              
              {activeTab === 'edit' && (
                <>
                  <button 
                    className="cancel-button" 
                    onClick={() => {
                      setActiveTab('list');
                      setEditingProject(null);
                      setProjectName('');
                      setProjectDescription('');
                      setProjectHost('');
                      setProjectPort('');
                      setProjectUsername('');
                      setProjectPassword('');
                      setEditProjectMessage('');
                    }}
                  >
                    取消
                  </button>
                  <button 
                    className="confirm-button" 
                    onClick={() => {
                      handleEditProject();
                      setActiveTab('list');
                    }}
                  >
                    确认更新
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 用户管理模态框 */}
      <UsersPage
        isOpen={showUsersModal}
        onClose={() => setShowUsersModal(false)}
      />

      {/* 程序详情模态框 */}
      <ProgramDetailPage
        isOpen={showProgramDetailModal}
        onClose={() => setShowProgramDetailModal(false)}
        programId={selectedProgramId}
      />

    </div>
  );
};

export default ProgramsPage;