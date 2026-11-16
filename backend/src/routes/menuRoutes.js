const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');
const { protect: authenticate } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');
const upload = require('../config/multer');

// All routes require authentication and restaurant owner role
router.use(authenticate);
router.use(authorize('restaurant_owner'));

// Menu item CRUD operations
router.post('/:restaurantId/items', upload.single('image'), menuController.createMenuItem);
router.get('/:restaurantId/items', menuController.getMenuItems);
router.put('/:restaurantId/items/:itemId', upload.single('image'), menuController.updateMenuItem);
router.delete('/:restaurantId/items/:itemId', menuController.deleteMenuItem);

// Availability operations
router.patch('/:restaurantId/items/:itemId/toggle', menuController.toggleMenuItemAvailability);

// Bulk operations
router.patch('/:restaurantId/items/reorder', menuController.reorderMenuItems);
router.patch('/:restaurantId/bulk/toggle-availability', menuController.bulkToggleAvailability);
router.delete('/:restaurantId/bulk/delete', menuController.bulkDeleteMenuItems);
router.patch('/:restaurantId/bulk/assign-category', menuController.bulkAssignCategory);

// Categories
router.get('/:restaurantId/categories', menuController.getCategories);

module.exports = router;
