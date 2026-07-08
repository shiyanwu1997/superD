const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../models/db');
const authMiddleware = require('../middleware/auth');
const { ApiError } = require('../utils/errors');

// API: 获取用户列表（根据角色权限返回不同的用户列表）
router.get('/api/users', authMiddleware.verifyToken, async (req, res, next) => {
  try {
    const currentUserId = req.session.user?.id || req.user.userId;
    const currentUser = await db.getUserById(currentUserId);

    if (!currentUser) {
      throw new ApiError(404, '用户不存在');
    }

    let users = [];

    if (currentUser.roleId === 1) {
      users = await db.getAllUsers();
    } else if (currentUser.roleId === 2) {
      const allUsers = await db.getAllUsers();
      users = allUsers.filter(user => {
        return user.id === currentUserId ||
               (user.createdBy !== null && user.createdBy === currentUserId);
      });
    } else {
      throw new ApiError(403, '没有权限访问用户列表');
    }

    const roles = await db.getAllRoles();
    const userProjectPermissions = await db.getAllUserProjectPermissions();
    const allUsers = await db.getAllUsers();

    const usersWithRoles = users.map(user => {
      const role = roles.find(r => r.id === user.roleId);
      const permissions = userProjectPermissions
        .filter(perm => perm.userId === user.id)
        .map(perm => ({ projectId: perm.projectId }));
      let createdByUsername = null;
      if (user.createdBy) {
        const admin = allUsers.find(u => u.id === user.createdBy);
        if (admin) createdByUsername = admin.username;
      }
      return {
        ...user,
        roleName: role ? role.name : '未知角色',
        projectPermissions: permissions,
        createdByUsername: createdByUsername
      };
    });

    res.json(usersWithRoles);
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    next(new ApiError(500, '获取用户列表失败', error.message));
  }
});

// API: 创建新用户（仅管理员）
router.post('/api/users', authMiddleware.verifyToken, authMiddleware.checkAdmin, async (req, res, next) => {
  try {
    const { username, password, roleId } = req.body;
    const parsedRoleId = parseInt(roleId);

    if (!username || !password) {
      throw new ApiError(400, '用户名和密码不能为空');
    }

    const currentUserId = req.session.user?.id || req.user.userId;
    const currentUser = await db.getUserById(currentUserId);

    if (currentUser.roleId === 2) {
      if (parsedRoleId !== 3) {
        throw new ApiError(403, '普通管理员只能创建普通用户');
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let createdBy = currentUserId;
    if (currentUser.roleId === 1 && req.body.createdBy) {
      createdBy = parseInt(req.body.createdBy);
      const parentAdmin = await db.getUserById(createdBy);
      if (!parentAdmin || (parentAdmin.roleId !== 1 && parentAdmin.roleId !== 2)) {
        throw new ApiError(400, '上级必须是超级管理员或管理员');
      }
    }

    const newUser = await db.createUser(username, hashedPassword, parsedRoleId, createdBy);

    if (newUser) {
      res.json({ success: true, message: '用户创建成功', user: newUser });
    } else {
      throw new ApiError(400, '用户名已存在');
    }
  } catch (error) {
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '创建新用户失败', error.message);
    }
    next(error);
  }
});

// API: 删除用户（仅管理员）
router.delete('/api/users/:userId', authMiddleware.verifyToken, authMiddleware.checkAdmin, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const userIdInt = parseInt(userId);

    if (isNaN(userIdInt)) {
      throw new ApiError(400, '无效的用户ID');
    }

    const currentUserId = req.session.user?.id || req.user.userId;
    const currentUser = await db.getUserById(currentUserId);
    const targetUser = await db.getUserById(userIdInt);

    if (currentUser.roleId !== 1 &&
        (targetUser.id !== currentUserId && targetUser.createdBy !== currentUserId)) {
      throw new ApiError(403, '没有权限删除该用户');
    }

    if (await db.deleteUser(userIdInt)) {
      res.json({ success: true, message: '用户删除成功' });
    } else {
      throw new ApiError(404, '用户不存在');
    }
  } catch (error) {
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '删除用户失败', error.message);
    }
    next(error);
  }
});

// API: 更新用户角色（仅管理员）
router.put('/api/users/:userId/role', authMiddleware.verifyToken, authMiddleware.checkAdmin, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { roleId } = req.body;
    const userIdInt = parseInt(userId);
    const roleIdInt = parseInt(roleId);

    if (isNaN(userIdInt) || isNaN(roleIdInt)) {
      throw new ApiError(400, '无效的用户ID或角色ID');
    }

    const currentUserId = req.session.user?.id || req.user.userId;
    const currentUser = await db.getUserById(currentUserId);
    const targetUser = await db.getUserById(userIdInt);

    if (currentUser.roleId !== 1 &&
        (targetUser.id !== currentUserId && targetUser.createdBy !== currentUserId)) {
      throw new ApiError(403, '没有权限修改该用户的角色');
    }

    if (currentUser.roleId === 2) {
      if (roleIdInt === 1) {
        throw new ApiError(403, '普通管理员不能创建超级管理员');
      }
    }

    if (currentUser.roleId === 1 && targetUser.roleId === 3 && roleIdInt === 2) {
      const users = await db.getAllUsers();
      const userIndex = users.findIndex(user => user.id === userIdInt);
      if (userIndex !== -1) {
        await db.updateUserRole(userIdInt, roleIdInt);
        await db.updateUserCreatedBy(userIdInt, currentUserId);
        res.json({ success: true, message: '用户角色更新成功' });
        return;
      }
    }

    if (await db.updateUserRole(userIdInt, roleIdInt)) {
      res.json({ success: true, message: '用户角色更新成功' });
    } else {
      throw new ApiError(404, '用户不存在');
    }
  } catch (error) {
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '更新用户角色失败', error.message);
    }
    next(error);
  }
});

// API: 更新用户的上级管理员（仅超级管理员）
router.put('/api/users/:userId/createdBy', authMiddleware.verifyToken, authMiddleware.checkAdmin, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { createdBy } = req.body;
    const userIdInt = parseInt(userId);
    const createdByInt = parseInt(createdBy);

    if (isNaN(userIdInt) || isNaN(createdByInt)) {
      throw new ApiError(400, '无效的用户ID或上级管理员ID');
    }

    const currentUserId = req.session.user?.id || req.user.userId;
    const currentUser = await db.getUserById(currentUserId);

    if (currentUser.roleId !== 1) {
      throw new ApiError(403, '只有超级管理员可以修改用户的上级管理员');
    }

    const targetUser = await db.getUserById(userIdInt);
    if (!targetUser) {
      throw new ApiError(404, '用户不存在');
    }

    if (targetUser.roleId !== 3) {
      throw new ApiError(400, '只有普通用户可以设置上级管理员');
    }

    const parentAdmin = await db.getUserById(createdByInt);
    if (!parentAdmin || (parentAdmin.roleId !== 1 && parentAdmin.roleId !== 2)) {
      throw new ApiError(400, '上级必须是超级管理员或管理员');
    }

    if (await db.updateUserCreatedBy(userIdInt, createdByInt)) {
      res.json({ success: true, message: '用户上级管理员更新成功' });
    } else {
      throw new ApiError(500, '用户上级管理员更新失败');
    }
  } catch (error) {
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '更新用户上级管理员失败', error.message);
    }
    next(error);
  }
});

// API: 用户修改自己的密码
router.put('/api/users/self/password', authMiddleware.verifyToken, async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.session.user?.id || req.user.userId;
    const user = await db.getUserById(userId);

    if (!user || !(await bcrypt.compare(oldPassword, user.password))) {
      throw new ApiError(400, '原密码错误');
    }

    if (!newPassword) {
      throw new ApiError(400, '新密码不能为空');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    if (await db.updateUserPassword(userId, hashedPassword)) {
      res.json({ success: true, message: '密码修改成功' });
    } else {
      throw new ApiError(500, '密码修改失败');
    }
  } catch (error) {
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '修改密码失败', error.message);
    }
    next(error);
  }
});

// API: 管理员修改用户密码（仅管理员）
router.put('/api/users/:userId/password', authMiddleware.verifyToken, authMiddleware.checkAdmin, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;
    const userIdInt = parseInt(userId);

    if (isNaN(userIdInt) || !newPassword) {
      throw new ApiError(400, '无效的用户ID或密码');
    }

    const currentUserId = req.session.user?.id || req.user.userId;
    const currentUser = await db.getUserById(currentUserId);
    const targetUser = await db.getUserById(userIdInt);

    if (currentUser.roleId !== 1 &&
        (targetUser.id !== currentUserId && targetUser.createdBy !== currentUserId)) {
      throw new ApiError(403, '没有权限修改该用户的密码');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    if (await db.updateUserPassword(userIdInt, hashedPassword)) {
      res.json({ success: true, message: '密码修改成功' });
    } else {
      throw new ApiError(404, '用户不存在');
    }
  } catch (error) {
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '修改密码失败', error.message);
    }
    next(error);
  }
});

// API: 获取所有角色
router.get('/api/roles', authMiddleware.verifyToken, async (req, res, next) => {
  try {
    const roles = await db.getAllRoles();
    res.json(roles);
  } catch (error) {
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '获取所有角色失败', error.message);
    }
    next(error);
  }
});

// API: 获取用户项目权限列表
router.get('/api/users/:userId/project-permissions', authMiddleware.verifyToken, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const userIdInt = parseInt(userId);

    if (isNaN(userIdInt)) {
      throw new ApiError(400, '无效的用户ID');
    }

    const currentUserId = req.session.user?.id || req.user.userId;
    const currentUser = await db.getUserById(currentUserId);
    const targetUser = await db.getUserById(userIdInt);

    if (currentUserId !== userIdInt && currentUser.roleId !== 1) {
      if (currentUser.roleId === 2 &&
          (targetUser.id !== currentUserId && targetUser.createdBy !== currentUserId)) {
        throw new ApiError(403, '没有权限访问此资源');
      }
      throw new ApiError(403, '没有权限访问此资源');
    }

    const userProjectPermissions = (await db.getAllUserProjectPermissions())
      .filter(perm => perm.userId === userIdInt)
      .map(perm => ({ projectId: perm.projectId }));

    res.json(userProjectPermissions);
  } catch (error) {
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '获取用户项目权限列表失败', error.message);
    }
    next(error);
  }
});

// API: 为用户添加项目权限（仅管理员）
router.post('/api/users/:userId/project-permissions', authMiddleware.verifyToken, authMiddleware.checkAdmin, authMiddleware.checkAdminProjectPermission, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { projectId } = req.body;
    const userIdInt = parseInt(userId);
    const projectIdInt = parseInt(projectId);

    if (isNaN(userIdInt) || isNaN(projectIdInt)) {
      throw new ApiError(400, '无效的用户ID或项目ID');
    }

    const currentUserId = req.session.user?.id || req.user.userId;
    const currentUser = await db.getUserById(currentUserId);

    const targetUser = await db.getUserById(userIdInt);
    if (targetUser && targetUser.username === 'admin') {
      throw new ApiError(403, 'admin用户的项目权限不可修改');
    }

    if (currentUser.roleId !== 1 &&
        (targetUser.id !== currentUserId && targetUser.createdBy !== currentUserId)) {
      throw new ApiError(403, '没有权限为该用户添加项目权限');
    }

    if (await db.addUserProjectPermission(userIdInt, projectIdInt)) {
      res.json({ success: true, message: '项目权限添加成功' });
    } else {
      throw new ApiError(500, '项目权限添加失败');
    }
  } catch (error) {
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '为用户添加项目权限失败', error.message);
    }
    next(error);
  }
});

// API: 移除用户的项目权限（仅管理员）
router.delete('/api/users/:userId/project-permissions/:projectId', authMiddleware.verifyToken, authMiddleware.checkAdmin, authMiddleware.checkAdminProjectPermission, async (req, res, next) => {
  try {
    const { userId, projectId } = req.params;
    const userIdInt = parseInt(userId);
    const projectIdInt = parseInt(projectId);

    if (isNaN(userIdInt) || isNaN(projectIdInt)) {
      throw new ApiError(400, '无效的用户ID或项目ID');
    }

    const currentUserId = req.session.user?.id || req.user.userId;
    const currentUser = await db.getUserById(currentUserId);

    const targetUser = await db.getUserById(userIdInt);
    if (targetUser && targetUser.username === 'admin') {
      throw new ApiError(403, 'admin用户的项目权限不可修改');
    }

    if (currentUser.roleId !== 1 &&
        (targetUser.id !== currentUserId && targetUser.createdBy !== currentUserId)) {
      throw new ApiError(403, '没有权限移除该用户的项目权限');
    }

    if (await db.removeUserProjectPermission(userIdInt, projectIdInt)) {
      res.json({ success: true, message: '项目权限移除成功' });
    } else {
      throw new ApiError(500, '项目权限移除失败');
    }
  } catch (error) {
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '移除用户项目权限失败', error.message);
    }
    next(error);
  }
});

// ==================== 程序级权限路由（细粒度控制） ====================

// API: 获取用户的程序权限列表
router.get('/api/users/:userId/program-permissions', authMiddleware.verifyToken, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const userIdInt = parseInt(userId);
    if (isNaN(userIdInt)) throw new ApiError(400, '无效的用户ID');

    const currentUserId = req.session.user?.id || req.user.userId;
    const currentUser = await db.getUserById(currentUserId);
    const targetUser = await db.getUserById(userIdInt);

    if (currentUserId !== userIdInt && currentUser.roleId !== 1) {
      if (currentUser.roleId === 2 && targetUser.createdBy !== currentUserId) {
        throw new ApiError(403, '没有权限访问此资源');
      }
    }

    const permissions = await db.getUserProgramPermissions(userIdInt);
    res.json(permissions);
  } catch (error) {
    if (!(error instanceof ApiError)) error = new ApiError(500, '获取程序权限失败', error.message);
    next(error);
  }
});

// API: 为用户添加程序权限（仅管理员）
router.post('/api/users/:userId/program-permissions', authMiddleware.verifyToken, authMiddleware.checkAdmin, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { programId } = req.body;
    const userIdInt = parseInt(userId);
    if (isNaN(userIdInt) || !programId) throw new ApiError(400, '无效的参数');

    const currentUserId = req.session.user?.id || req.user.userId;
    const currentUser = await db.getUserById(currentUserId);
    const targetUser = await db.getUserById(userIdInt);

    if (targetUser && targetUser.username === 'admin') throw new ApiError(403, 'admin用户的权限不可修改');
    if (currentUser.roleId !== 1 && targetUser.createdBy !== currentUserId) {
      throw new ApiError(403, '没有权限为该用户添加程序权限');
    }

    await db.addUserProgramPermission(userIdInt, programId);
    res.json({ success: true, message: '程序权限添加成功' });
  } catch (error) {
    if (!(error instanceof ApiError)) error = new ApiError(500, '添加程序权限失败', error.message);
    next(error);
  }
});

// API: 移除用户的程序权限
router.delete('/api/users/:userId/program-permissions/:programId', authMiddleware.verifyToken, authMiddleware.checkAdmin, async (req, res, next) => {
  try {
    const { userId, programId } = req.params;
    const userIdInt = parseInt(userId);
    if (isNaN(userIdInt) || !programId) throw new ApiError(400, '无效的参数');

    const currentUserId = req.session.user?.id || req.user.userId;
    const currentUser = await db.getUserById(currentUserId);
    const targetUser = await db.getUserById(userIdInt);

    if (targetUser && targetUser.username === 'admin') throw new ApiError(403, 'admin用户的权限不可修改');
    if (currentUser.roleId !== 1 && targetUser.createdBy !== currentUserId) {
      throw new ApiError(403, '没有权限移除该用户的程序权限');
    }

    await db.removeUserProgramPermission(userIdInt, programId);
    res.json({ success: true, message: '程序权限移除成功' });
  } catch (error) {
    if (!(error instanceof ApiError)) error = new ApiError(500, '移除程序权限失败', error.message);
    next(error);
  }
});

module.exports = router;
