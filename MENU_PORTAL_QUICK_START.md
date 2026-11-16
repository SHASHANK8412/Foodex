# 🍽️ Foodex Menu Management Portal - Quick Start Guide

## What Was Built

A complete, production-ready Restaurant Menu Management Portal with full backend + frontend implementation.

---

## ⚡ Quick Setup

### 1. Backend Configuration

Add to `backend/.env`:
```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Get your Cloudinary credentials at: https://cloudinary.com/console

### 2. Frontend Dependencies

Already installed:
```bash
✅ react-beautiful-dnd (drag-and-drop)
✅ react-dropzone (file uploads)
✅ react-hook-form (forms)
✅ zod (validation)
✅ sonner (notifications)
```

### 3. Access the Portal

**Route:** `/restaurant/:restaurantId/menu`

**Required Roles:** `restaurant_owner` or `admin`

---

## 📋 Files Created/Modified

### Backend

| File | Purpose |
|------|---------|
| `backend/src/config/multer.js` | Memory-based file upload config (5MB max) |
| `backend/src/services/cloudinaryService.js` | Cloudinary integration (upload/delete) |
| `backend/src/models/MenuItem.js` | Enhanced schema with all menu properties |
| `backend/src/controllers/menuController.js` | 10 endpoints for CRUD + bulk ops |
| `backend/src/routes/menuRoutes.js` | Protected menu endpoints |
| `backend/src/routes/index.js` | Route registration |
| `backend/.env` | Cloudinary credentials |

### Frontend Components

| File | Purpose |
|------|---------|
| `frontend/src/pages/MenuDashboardPage.jsx` | Main dashboard with grid + filtering |
| `frontend/src/components/AddEditItemModal.jsx` | Right-side drawer form (650+ lines) |
| `frontend/src/components/ImageUploadSection.jsx` | Drag-drop upload with preview |
| `frontend/src/components/CategoryManager.jsx` | Category sidebar with drag-reorder |
| `frontend/src/components/BulkActionsToolbar.jsx` | Floating bulk operations toolbar |
| `frontend/src/validators/menuValidator.js` | Zod validation schemas |
| `frontend/src/redux/slices/menuSlice.js` | Redux state management (13 thunks) |
| `frontend/src/App.jsx` | Route registration |
| `frontend/tailwind.config.js` | Slideup animation |

---

## 🎯 Backend API Endpoints

### Menu Items
- `POST /api/menu/:restaurantId/items` - Create with image
- `GET /api/menu/:restaurantId/items` - Fetch with filters
- `PUT /api/menu/:restaurantId/items/:itemId` - Edit (replace image)
- `DELETE /api/menu/:restaurantId/items/:itemId` - Delete + cleanup

### Availability
- `PATCH /api/menu/:restaurantId/items/:itemId/toggle` - Single toggle
- `PATCH /api/menu/:restaurantId/bulk/toggle-availability` - Bulk toggle

### Bulk Operations
- `DELETE /api/menu/:restaurantId/bulk/delete` - Bulk delete
- `PATCH /api/menu/:restaurantId/bulk/assign-category` - Bulk assign

### Reordering
- `PATCH /api/menu/:restaurantId/items/reorder` - Drag-reorder items

### Categories
- `GET /api/menu/:restaurantId/categories` - Get distinct categories

---

## ✨ Key Features Implemented

### ✅ Core CRUD
- [x] Create menu items with image upload to Cloudinary
- [x] Edit items (replace images on update)
- [x] Delete items (automatic image cleanup)
- [x] Get items with category/availability filtering

### ✅ Advanced Properties
- [x] Price + Discounted Price (with % discount display)
- [x] Vegetarian toggle
- [x] Featured items badge
- [x] Spice level (mild/medium/hot)
- [x] Prep time (0-240 minutes)
- [x] Multiple tags (chip input)
- [x] Nutrition info (calories, protein, carbs)
- [x] Availability status toggle
- [x] Sort order for drag-reorder

### ✅ UI/UX Features
- [x] Drag-and-drop grid for reordering
- [x] Image drag-drop upload with preview
- [x] Real-time file preview
- [x] Right-side drawer modal for editing
- [x] Form validation with Zod schemas
- [x] Toast notifications (success/error)
- [x] Loading states and disabled buttons
- [x] Responsive design (mobile-first)
- [x] Category filtering sidebar
- [x] Availability filtering
- [x] Search/filter categories

### ✅ Bulk Operations
- [x] Multi-select with checkbox
- [x] Select all / Clear all
- [x] Bulk toggle availability (Enable/Disable)
- [x] Bulk delete items (with confirmation)
- [x] Bulk assign category
- [x] Floating toolbar appears when items selected

### ✅ Image Handling
- [x] Memory storage (no disk writes)
- [x] Multer middleware (5MB max, JPEG/PNG only)
- [x] Direct stream to Cloudinary (no disk I/O)
- [x] Secure URL storage in database
- [x] Public ID for deletion tracking
- [x] Automatic cleanup on item delete
- [x] Image replacement on update

### ✅ Validation & Error Handling
- [x] Client-side Zod validation
- [x] Server-side input validation
- [x] JWT authentication
- [x] Role-based access control
- [x] Specific HTTP status codes (400, 401, 403, 404, 413, 500)
- [x] Descriptive error messages
- [x] Toast notifications for feedback

### ✅ Performance
- [x] Database indexes (restaurant, sortOrder, category, isAvailable)
- [x] Optimistic UI updates
- [x] Redux Toolkit for efficient state management
- [x] Bulk write operations for reordering

---

## 📊 Data Model

```javascript
MenuItem {
  _id: ObjectId
  restaurant: ObjectId (ref)
  name: String (required)
  description: String
  category: String (required)
  price: Number (required)
  discountedPrice: Number
  tags: [String]
  isVeg: Boolean
  isAvailable: Boolean
  isFeatured: Boolean
  spiceLevel: 'mild' | 'medium' | 'hot'
  prepTime: Number
  image: {
    url: String (Cloudinary)
    publicId: String
  }
  nutritionInfo: {
    calories: Number
    protein: Number
    carbs: Number
  }
  sortOrder: Number
  estimatedCost: Number
  createdAt: Date
  updatedAt: Date
}
```

---

## 🔐 Security

- ✅ JWT authentication on all endpoints
- ✅ Restaurant owner role middleware
- ✅ Image MIME type validation
- ✅ File size limits enforced
- ✅ Cloudinary API credentials secured in .env
- ✅ Automatic image cleanup prevents orphaned files
- ✅ Input validation with Zod schemas

---

## 🧪 Testing the Portal

### 1. Create a Menu Item
- Click "Add Item"
- Fill form: name, category, price
- Upload image (drag-drop or click)
- Add tags (type name, press Enter)
- Click "Create Item"

### 2. Edit an Item
- Click edit icon on item card
- Modify fields
- Replace image if needed
- Click "Update Item"

### 3. Reorder Items
- Drag items on grid
- Watch sortOrder update
- Reorder persists after refresh

### 4. Bulk Operations
- Check items with checkbox
- "Select All" checkbox for quick selection
- Use toolbar: Enable/Disable, Delete, or Assign Category
- Toolbar appears at bottom

### 5. Filter
- Filter by category (left sidebar)
- Filter by availability (Show dropdown)
- Combine filters together

---

## 📁 Project Structure

```
foodex/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── multer.js
│   │   ├── services/
│   │   │   └── cloudinaryService.js
│   │   ├── controllers/
│   │   │   └── menuController.js
│   │   ├── models/
│   │   │   └── MenuItem.js
│   │   └── routes/
│   │       ├── menuRoutes.js
│   │       └── index.js
│   └── .env
│
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   └── MenuDashboardPage.jsx
    │   ├── components/
    │   │   ├── AddEditItemModal.jsx
    │   │   ├── ImageUploadSection.jsx
    │   │   ├── CategoryManager.jsx
    │   │   └── BulkActionsToolbar.jsx
    │   ├── validators/
    │   │   └── menuValidator.js
    │   ├── redux/
    │   │   ├── slices/
    │   │   │   └── menuSlice.js
    │   │   └── store.js
    │   ├── App.jsx
    │   └── ...
    ├── tailwind.config.js
    └── package.json
```

---

## 📞 API Example: Create Item

```bash
curl -X POST http://localhost:5003/api/menu/restaurant_id/items \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "name=Margherita Pizza" \
  -F "description=Classic tomato and mozzarella" \
  -F "category=Pizzas" \
  -F "price=299" \
  -F "discountedPrice=249" \
  -F "isVeg=true" \
  -F "spiceLevel=mild" \
  -F "prepTime=15" \
  -F "tags=[\"vegetarian\",\"bestseller\"]" \
  -F "image=@/path/to/image.jpg"
```

---

## 🚀 Next Steps

1. **Set Cloudinary Credentials**
   - Update `backend/.env` with your Cloudinary credentials
   - Start backend server: `npm run dev`

2. **Test the Portal**
   - Navigate to `/restaurant/:restaurantId/menu`
   - Create your first menu item
   - Upload an image
   - Try drag-reordering

3. **Documentation**
   - See `MENU_PORTAL_DOCUMENTATION.md` for full API reference
   - Check validation rules and error handling

4. **Future Enhancements**
   - Real-time collaboration with WebSockets
   - Image compression before upload
   - Menu versioning and history
   - Combo meal builder
   - Seasonal availability

---

## 📝 Notes

- All images are hosted on Cloudinary (no local storage)
- Drag-and-drop uses react-beautiful-dnd (deprecated but works)
- Component runs on `/restaurant/:restaurantId/menu` route
- Redux state is fully managed with optimistic updates
- All forms validated with Zod before submission
- Toast notifications provide user feedback

---

**Build Status:** ✅ Complete - Ready for testing!

For detailed API documentation and troubleshooting, see `MENU_PORTAL_DOCUMENTATION.md`
