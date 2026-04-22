import { Router } from "express";
import { UserController } from "../controllers/user.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = Router();
const userController = new UserController();

// All user routes require authentication
router.use(authMiddleware);

// GET /users - List all users
router.get("/", userController.getUsers);

// GET /users/me - Get current authenticated user
router.get("/me", userController.getCurrentUser);

// GET /users/me/permissions - Get resolved permissions for current user
router.get("/me/permissions", userController.getCurrentUserPermissions);

// GET /users/roles - List built-in and custom roles
router.get("/roles", userController.getRoleConfigurations);

// POST /users/roles - Create custom role
router.post("/roles", userController.createRoleConfiguration);

// PUT /users/roles/:key - Update built-in/custom role config
router.put("/roles/:key", userController.updateRoleConfiguration);

// DELETE /users/roles/:key - Delete custom role
router.delete("/roles/:key", userController.deleteRoleConfiguration);

// GET /users/audit-logs - Admin audit log (superuser only)
router.get("/audit-logs", userController.getAdminAuditLogs);

// GET /users/:id/stats - Get specific user stats
router.get("/:id/stats", userController.getUserStatsById);

// GET /users/:id - Get specific user
router.get("/:id", userController.getUserById);

// POST /users - Admin creates a new user account
router.post("/", userController.createUser);

// PUT /users/me - Update current user profile
router.put("/me", userController.updateCurrentUser);

// PUT /users/me/password - Change current user password
router.put("/me/password", userController.changePassword);

// PUT /users/:id/block - Block or unblock a user
router.put("/:id/block", userController.toggleBlockUser);

// PUT /users/:id - Update user profile
router.put("/:id", userController.updateUser);

// DELETE /users/:id - Delete a user (admin+)
router.delete("/:id", userController.deleteUser);

export default router;
