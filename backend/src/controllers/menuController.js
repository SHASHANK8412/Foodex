const MenuItem = require('../models/MenuItem');
const { uploadToCloudinary, deleteFromCloudinary } = require('../services/cloudinaryService');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// Create a new menu item with image upload
exports.createMenuItem = asyncHandler(async (req, res) => {
  const { name, description, price, discountedPrice, category, tags, isVeg, isFeatured, spiceLevel, prepTime, nutritionInfo } = req.body;
  const { restaurantId } = req.params;

  if (!name || !price || !category) {
    throw new ApiError(400, 'Name, price, and category are required');
  }

  let imageData = {};

  // Upload image to Cloudinary if file provided
  if (req.file) {
    const cloudinaryResult = await uploadToCloudinary(req.file.buffer);
    imageData = {
      url: cloudinaryResult.secure_url,
      publicId: cloudinaryResult.public_id,
    };
  }

  const menuItem = new MenuItem({
    restaurant: restaurantId,
    name: name.trim(),
    description: description?.trim(),
    price: parseFloat(price),
    discountedPrice: discountedPrice ? parseFloat(discountedPrice) : undefined,
    category: category.trim(),
    tags: Array.isArray(tags) ? tags.map(t => t.trim()).filter(t => t) : [],
    isVeg: isVeg === 'true' || isVeg === true,
    isFeatured: isFeatured === 'true' || isFeatured === true,
    spiceLevel: spiceLevel || 'medium',
    prepTime: prepTime ? parseInt(prepTime) : 0,
    image: imageData,
    nutritionInfo: nutritionInfo ? {
      calories: nutritionInfo.calories ? parseFloat(nutritionInfo.calories) : undefined,
      protein: nutritionInfo.protein ? parseFloat(nutritionInfo.protein) : undefined,
      carbs: nutritionInfo.carbs ? parseFloat(nutritionInfo.carbs) : undefined,
    } : undefined,
  });

  await menuItem.save();

  res.status(201).json({
    success: true,
    data: menuItem,
    message: 'Menu item created successfully',
  });
});

// Update a menu item (including image replacement)
exports.updateMenuItem = asyncHandler(async (req, res) => {
  const { itemId, restaurantId } = req.params;
  const { name, description, price, discountedPrice, category, tags, isVeg, isFeatured, spiceLevel, prepTime, nutritionInfo } = req.body;

  const menuItem = await MenuItem.findOne({ _id: itemId, restaurant: restaurantId });
  if (!menuItem) {
    throw new ApiError(404, 'Menu item not found');
  }

  // If new image file is provided, upload it and delete old one
  if (req.file) {
    const cloudinaryResult = await uploadToCloudinary(req.file.buffer);
    
    // Delete old image from Cloudinary if it exists
    if (menuItem.image?.publicId) {
      await deleteFromCloudinary(menuItem.image.publicId);
    }

    menuItem.image = {
      url: cloudinaryResult.secure_url,
      publicId: cloudinaryResult.public_id,
    };
  }

  // Update other fields
  if (name) menuItem.name = name.trim();
  if (description !== undefined) menuItem.description = description?.trim();
  if (price) menuItem.price = parseFloat(price);
  if (discountedPrice !== undefined) menuItem.discountedPrice = discountedPrice ? parseFloat(discountedPrice) : undefined;
  if (category) menuItem.category = category.trim();
  if (tags !== undefined) menuItem.tags = Array.isArray(tags) ? tags.map(t => t.trim()).filter(t => t) : [];
  if (isVeg !== undefined) menuItem.isVeg = isVeg === 'true' || isVeg === true;
  if (isFeatured !== undefined) menuItem.isFeatured = isFeatured === 'true' || isFeatured === true;
  if (spiceLevel) menuItem.spiceLevel = spiceLevel;
  if (prepTime !== undefined) menuItem.prepTime = parseInt(prepTime);

  if (nutritionInfo) {
    menuItem.nutritionInfo = {
      calories: nutritionInfo.calories ? parseFloat(nutritionInfo.calories) : undefined,
      protein: nutritionInfo.protein ? parseFloat(nutritionInfo.protein) : undefined,
      carbs: nutritionInfo.carbs ? parseFloat(nutritionInfo.carbs) : undefined,
    };
  }

  await menuItem.save();

  res.json({
    success: true,
    data: menuItem,
    message: 'Menu item updated successfully',
  });
});

// Delete a menu item (and remove image from Cloudinary)
exports.deleteMenuItem = asyncHandler(async (req, res) => {
  const { itemId, restaurantId } = req.params;

  const menuItem = await MenuItem.findOne({ _id: itemId, restaurant: restaurantId });
  if (!menuItem) {
    throw new ApiError(404, 'Menu item not found');
  }

  // Delete image from Cloudinary
  if (menuItem.image?.publicId) {
    await deleteFromCloudinary(menuItem.image.publicId);
  }

  await MenuItem.deleteOne({ _id: itemId });

  res.json({
    success: true,
    message: 'Menu item deleted successfully',
  });
});

// Toggle availability of a menu item
exports.toggleMenuItemAvailability = asyncHandler(async (req, res) => {
  const { itemId, restaurantId } = req.params;

  const menuItem = await MenuItem.findOne({ _id: itemId, restaurant: restaurantId });
  if (!menuItem) {
    throw new ApiError(404, 'Menu item not found');
  }

  menuItem.isAvailable = !menuItem.isAvailable;
  await menuItem.save();

  res.json({
    success: true,
    data: menuItem,
    message: `Menu item ${menuItem.isAvailable ? 'enabled' : 'disabled'} successfully`,
  });
});

// Bulk reorder menu items
exports.reorderMenuItems = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;
  const { items } = req.body; // Array of { id, sortOrder }

  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'Items array is required');
  }

  const bulkOps = items.map(item => ({
    updateOne: {
      filter: { _id: item.id, restaurant: restaurantId },
      update: { $set: { sortOrder: item.sortOrder } },
    },
  }));

  await MenuItem.bulkWrite(bulkOps);

  // Fetch updated items
  const updatedItems = await MenuItem.find({ restaurant: restaurantId }).sort({ sortOrder: 1 });

  res.json({
    success: true,
    data: updatedItems,
    message: 'Menu items reordered successfully',
  });
});

// Get all categories for a restaurant
exports.getCategories = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;

  const categories = await MenuItem.distinct('category', { restaurant: restaurantId });

  res.json({
    success: true,
    data: categories.sort(),
  });
});

// Get all menu items for a restaurant
exports.getMenuItems = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;
  const { category, isAvailable } = req.query;

  let query = { restaurant: restaurantId };

  if (category) {
    query.category = category;
  }

  if (isAvailable !== undefined) {
    query.isAvailable = isAvailable === 'true';
  }

  const menuItems = await MenuItem.find(query).sort({ sortOrder: 1, createdAt: -1 });

  res.json({
    success: true,
    data: menuItems,
  });
});

// Bulk toggle availability
exports.bulkToggleAvailability = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;
  const { itemIds, isAvailable } = req.body;

  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    throw new ApiError(400, 'Item IDs array is required');
  }

  const result = await MenuItem.updateMany(
    { _id: { $in: itemIds }, restaurant: restaurantId },
    { $set: { isAvailable } }
  );

  res.json({
    success: true,
    data: { modifiedCount: result.modifiedCount },
    message: `${result.modifiedCount} items ${isAvailable ? 'enabled' : 'disabled'} successfully`,
  });
});

// Bulk delete menu items
exports.bulkDeleteMenuItems = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;
  const { itemIds } = req.body;

  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    throw new ApiError(400, 'Item IDs array is required');
  }

  // Get items to delete their images
  const itemsToDelete = await MenuItem.find({ _id: { $in: itemIds }, restaurant: restaurantId });

  // Delete images from Cloudinary
  for (const item of itemsToDelete) {
    if (item.image?.publicId) {
      await deleteFromCloudinary(item.image.publicId);
    }
  }

  const result = await MenuItem.deleteMany({ _id: { $in: itemIds }, restaurant: restaurantId });

  res.json({
    success: true,
    data: { deletedCount: result.deletedCount },
    message: `${result.deletedCount} items deleted successfully`,
  });
});

// Bulk assign category
exports.bulkAssignCategory = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;
  const { itemIds, category } = req.body;

  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    throw new ApiError(400, 'Item IDs array is required');
  }

  if (!category) {
    throw new ApiError(400, 'Category is required');
  }

  const result = await MenuItem.updateMany(
    { _id: { $in: itemIds }, restaurant: restaurantId },
    { $set: { category: category.trim() } }
  );

  res.json({
    success: true,
    data: { modifiedCount: result.modifiedCount },
    message: `${result.modifiedCount} items assigned to category "${category}" successfully`,
  });
});
