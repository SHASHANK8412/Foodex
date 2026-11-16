# Restaurant Menu Management Portal - Implementation Guide

## Overview
A complete menu management system for Foodex with drag-and-drop reordering, image uploads, category management, and bulk operations.

## Backend Setup

### 1. Cloudinary Configuration
Add your Cloudinary credentials to `backend/.env`:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Get these credentials from: https://cloudinary.com/console

### 2. Required Packages (Already Installed)
- `cloudinary` - Image hosting
- `multer` - File upload handling
- `mongoose` - Database ODM

### 3. API Endpoints

All endpoints require restaurant owner JWT authentication.

#### Menu Items

**Create Item** (with image)
```
POST /api/menu/:restaurantId/items
Content-Type: multipart/form-data
Authorization: Bearer <token>

Body:
- name (string, required)
- description (string)
- category (string, required)
- price (number, required)
- discountedPrice (number)
- image (file, optional - JPEG/PNG, max 5MB)
- tags (JSON array)
- isVeg (boolean)
- isFeatured (boolean)
- spiceLevel (mild/medium/hot)
- prepTime (number - minutes)
- nutritionInfo (JSON object - {calories, protein, carbs})
```

**Get Items**
```
GET /api/menu/:restaurantId/items?category=Pizza&isAvailable=true
Authorization: Bearer <token>
```

**Update Item** (with optional image replacement)
```
PUT /api/menu/:restaurantId/items/:itemId
Content-Type: multipart/form-data
Authorization: Bearer <token>

Body: Same as Create (only changed fields needed)
```

**Delete Item** (removes image from Cloudinary)
```
DELETE /api/menu/:restaurantId/items/:itemId
Authorization: Bearer <token>
```

#### Availability Management

**Toggle Single Item**
```
PATCH /api/menu/:restaurantId/items/:itemId/toggle
Authorization: Bearer <token>
```

**Bulk Toggle (Multiple Items)**
```
PATCH /api/menu/:restaurantId/bulk/toggle-availability
Authorization: Bearer <token>

Body:
{
  "itemIds": ["id1", "id2"],
  "isAvailable": true
}
```

#### Reordering

**Reorder Items**
```
PATCH /api/menu/:restaurantId/items/reorder
Authorization: Bearer <token>

Body:
{
  "items": [
    { "id": "itemId1", "sortOrder": 0 },
    { "id": "itemId2", "sortOrder": 1 }
  ]
}
```

#### Category Management

**Get Categories**
```
GET /api/menu/:restaurantId/categories
Authorization: Bearer <token>
```

**Bulk Assign Category**
```
PATCH /api/menu/:restaurantId/bulk/assign-category
Authorization: Bearer <token>

Body:
{
  "itemIds": ["id1", "id2"],
  "category": "Pizza"
}
```

**Bulk Delete**
```
DELETE /api/menu/:restaurantId/bulk/delete
Authorization: Bearer <token>

Body:
{
  "itemIds": ["id1", "id2"]
}
```

## Frontend Setup

### 1. Dependencies (Already Installed)
```bash
npm install react-beautiful-dnd react-dropzone react-hook-form zod sonner axios --legacy-peer-deps
```

### 2. Route Access
Navigate to: `/restaurant/:restaurantId/menu`

Requires authentication with `restaurant_owner` or `admin` role.

## Features

### Menu Item Management
- ✅ Create, update, delete menu items
- ✅ Upload item images to Cloudinary
- ✅ Replace images on update
- ✅ Automatic image cleanup on delete

### Item Properties
- ✅ Name, description, category
- ✅ Price and discounted price (with % discount display)
- ✅ Vegetarian toggle
- ✅ Featured items badge
- ✅ Spice level (mild/medium/hot)
- ✅ Prep time in minutes
- ✅ Tags (multiple)
- ✅ Nutrition info (calories, protein, carbs)
- ✅ Availability status

### User Interface
- ✅ Drag-and-drop grid for item reordering
- ✅ Image drag-and-drop upload with preview
- ✅ Form validation with Zod schemas
- ✅ Toast notifications for feedback
- ✅ Category-based filtering
- ✅ Availability filtering
- ✅ Search/filter category manager
- ✅ Responsive design (mobile, tablet, desktop)

### Bulk Operations
- ✅ Select all/individual items
- ✅ Bulk toggle availability
- ✅ Bulk delete items
- ✅ Bulk assign category
- ✅ Clear selection

### Category Management
- ✅ Auto-generated from distinct item categories
- ✅ Drag-to-reorder categories
- ✅ Search/filter categories
- ✅ Create new categories while editing items
- ✅ Filter items by category

## Data Model

### MenuItem Schema
```javascript
{
  _id: ObjectId,
  restaurant: ObjectId (ref: Restaurant),
  name: String (required),
  description: String,
  category: String (required),
  price: Number (required, min: 0),
  discountedPrice: Number,
  tags: [String],
  isVeg: Boolean,
  isAvailable: Boolean,
  isFeatured: Boolean,
  spiceLevel: 'mild' | 'medium' | 'hot',
  prepTime: Number (minutes),
  image: {
    url: String (Cloudinary secure_url),
    publicId: String (Cloudinary public_id)
  },
  nutritionInfo: {
    calories: Number,
    protein: Number,
    carbs: Number
  },
  sortOrder: Number,
  createdAt: Date,
  updatedAt: Date
}
```

## Validation Rules

### Create/Update Item Validation
- `name`: 2-100 characters, required
- `category`: 2-50 characters, required
- `price`: > 0, required
- `discountedPrice`: > 0, optional
- `description`: max 500 characters
- `tags`: max 30 characters each
- `spiceLevel`: mild, medium, or hot
- `prepTime`: 0-240 minutes
- `image`: JPEG/PNG only, max 5MB

## Error Handling

### Common Errors
- `400 Bad Request` - Validation failed
- `401 Unauthorized` - Missing/invalid JWT
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Item/restaurant not found
- `413 Payload Too Large` - Image exceeds 5MB
- `500 Internal Server Error` - Server error or Cloudinary failure

### Cloudinary Errors
- Image upload failures due to network issues will be retried
- Invalid credentials will cause descriptive errors
- Storage quota exceeded will return appropriate error message

## Redux State Management

### Menu Slice Structure
```javascript
{
  items: MenuItem[],
  categories: String[],
  selectedItems: ObjectId[],
  loading: {
    items: boolean,
    categories: boolean,
    action: boolean
  },
  error: {
    items: string | null,
    categories: string | null,
    action: string | null
  },
  success: string | null
}
```

### Available Actions
- `fetchMenuItems` - Load items with filtering
- `fetchCategories` - Load distinct categories
- `createMenuItem` - Create with image upload
- `updateMenuItem` - Update with optional image
- `deleteMenuItem` - Delete item and image
- `toggleMenuItemAvailability` - Toggle single item
- `reorderMenuItems` - Reorder multiple items
- `bulkToggleAvailability` - Toggle multiple items
- `bulkDeleteMenuItems` - Delete multiple items
- `bulkAssignCategory` - Assign category to multiple
- `toggleItemSelection` - Select/deselect items
- `selectAllItems` - Select all visible items
- `clearSelection` - Deselect all items

## Performance Optimizations

1. **Memory Storage Upload** - File buffers streamed directly to Cloudinary (no disk I/O)
2. **Database Indexes** - Indexed on `restaurant`, `sortOrder`, `category`, `isAvailable`
3. **Optimistic UI Updates** - Toggle availability updates UI immediately
4. **Lazy Loaded Images** - Use native lazy loading in image previews
5. **Form Validation** - Client-side validation before submission
6. **Pagination Ready** - Backend supports limit/skip parameters (can be added to frontend)

## Testing Checklist

### Backend
- [ ] Test file upload with valid image
- [ ] Test file upload with invalid file type
- [ ] Test file upload exceeding 5MB
- [ ] Test Cloudinary upload/delete operations
- [ ] Test JWT authentication
- [ ] Test role-based access control
- [ ] Test bulk operations with empty array
- [ ] Test category distinct query
- [ ] Test reorder with out-of-order IDs

### Frontend
- [ ] Create new menu item
- [ ] Edit existing menu item
- [ ] Delete menu item (with confirmation)
- [ ] Upload image and see preview
- [ ] Replace existing image
- [ ] Drag to reorder items
- [ ] Select/deselect items
- [ ] Bulk toggle availability
- [ ] Bulk delete items
- [ ] Bulk assign category
- [ ] Filter by category
- [ ] Filter by availability
- [ ] Toast notifications appear
- [ ] Form validation messages show

## Known Limitations

1. **react-beautiful-dnd Deprecated** - Consider migrating to `dnd-kit` for future versions
2. **No Real-Time Sync** - Menu updates not synced across simultaneous editors
3. **Image Compression** - Images not automatically compressed before upload
4. **Category Limited to Strings** - No category descriptions or metadata
5. **Deletion Confirms** - No undo after deletion
6. **No Bulk Edit** - Cannot bulk edit properties other than availability/category

## Future Enhancements

1. Image compression and optimization
2. Real-time collaboration with WebSockets
3. Menu templates and duplication
4. Advanced analytics (popular items, discount impact)
5. Multi-language support for item descriptions
6. Nutritional label generation
7. Allergen management
8. Seasonal/time-based availability
9. Combo meal builder
10. Menu versioning and history

## Troubleshooting

### Image Upload Fails
- Check Cloudinary credentials in `.env`
- Verify file size < 5MB
- Ensure file is JPEG or PNG
- Check network connection

### Category Not Appearing
- Ensure at least one item in that category exists
- Try refreshing the page
- Check browser console for errors

### Bulk Operations Not Working
- Verify items are selected
- Check that items belong to current restaurant
- Ensure JWT token is valid

### Drag-and-Drop Not Working
- Install `react-beautiful-dnd` correctly with `--legacy-peer-deps`
- Check browser console for errors
- Try refreshing the page

## Support & Debugging

Enable debug logging in Redux by adding:
```javascript
console.log('Menu State:', state.menu);
```

For API debugging:
```javascript
console.log('API Error:', error.response?.data);
```

Monitor Cloudinary uploads in console:
```javascript
// In cloudinaryService.js
console.log('Cloudinary Response:', result);
```
