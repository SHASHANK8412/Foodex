import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// Async thunks
export const fetchMenuItems = createAsyncThunk(
  'menu/fetchMenuItems',
  async ({ restaurantId, category, isAvailable }, { rejectWithValue }) => {
    try {
      const params = {};
      if (category) params.category = category;
      if (isAvailable !== undefined) params.isAvailable = isAvailable;
      
      const response = await api.get(`/menu/${restaurantId}/items`, { params });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch menu items');
    }
  }
);

export const fetchCategories = createAsyncThunk(
  'menu/fetchCategories',
  async ({ restaurantId }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/menu/${restaurantId}/categories`);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch categories');
    }
  }
);

export const createMenuItem = createAsyncThunk(
  'menu/createMenuItem',
  async ({ restaurantId, formData }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/menu/${restaurantId}/items`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create menu item');
    }
  }
);

export const updateMenuItem = createAsyncThunk(
  'menu/updateMenuItem',
  async ({ restaurantId, itemId, formData }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/menu/${restaurantId}/items/${itemId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update menu item');
    }
  }
);

export const deleteMenuItem = createAsyncThunk(
  'menu/deleteMenuItem',
  async ({ restaurantId, itemId }, { rejectWithValue }) => {
    try {
      await api.delete(`/menu/${restaurantId}/items/${itemId}`);
      return itemId;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete menu item');
    }
  }
);

export const toggleMenuItemAvailability = createAsyncThunk(
  'menu/toggleAvailability',
  async ({ restaurantId, itemId }, { rejectWithValue }) => {
    try {
      const response = await api.patch(`/menu/${restaurantId}/items/${itemId}/toggle`);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to toggle availability');
    }
  }
);

export const reorderMenuItems = createAsyncThunk(
  'menu/reorderItems',
  async ({ restaurantId, items }, { rejectWithValue }) => {
    try {
      const response = await api.patch(`/menu/${restaurantId}/items/reorder`, { items });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to reorder items');
    }
  }
);

export const bulkToggleAvailability = createAsyncThunk(
  'menu/bulkToggleAvailability',
  async ({ restaurantId, itemIds, isAvailable }, { rejectWithValue }) => {
    try {
      const response = await api.patch(`/menu/${restaurantId}/bulk/toggle-availability`, {
        itemIds,
        isAvailable,
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to toggle availability');
    }
  }
);

export const bulkDeleteMenuItems = createAsyncThunk(
  'menu/bulkDelete',
  async ({ restaurantId, itemIds }, { rejectWithValue }) => {
    try {
      const response = await api.delete(`/menu/${restaurantId}/bulk/delete`, {
        data: { itemIds },
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete items');
    }
  }
);

export const bulkAssignCategory = createAsyncThunk(
  'menu/bulkAssignCategory',
  async ({ restaurantId, itemIds, category }, { rejectWithValue }) => {
    try {
      const response = await api.patch(`/menu/${restaurantId}/bulk/assign-category`, {
        itemIds,
        category,
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to assign category');
    }
  }
);

const initialState = {
  items: [],
  categories: [],
  selectedItems: [],
  loading: {
    items: false,
    categories: false,
    action: false,
  },
  error: {
    items: null,
    categories: null,
    action: null,
  },
  success: null,
};

const menuSlice = createSlice({
  name: 'menu',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = initialState.error;
    },
    clearSuccess: (state) => {
      state.success = null;
    },
    toggleItemSelection: (state, action) => {
      const itemId = action.payload;
      if (state.selectedItems.includes(itemId)) {
        state.selectedItems = state.selectedItems.filter(id => id !== itemId);
      } else {
        state.selectedItems.push(itemId);
      }
    },
    selectAllItems: (state) => {
      state.selectedItems = state.items.map(item => item._id);
    },
    clearSelection: (state) => {
      state.selectedItems = [];
    },
    // Optimistic update for toggle
    toggleItemAvailabilityOptimistic: (state, action) => {
      const itemId = action.payload;
      const item = state.items.find(i => i._id === itemId);
      if (item) {
        item.isAvailable = !item.isAvailable;
      }
    },
  },
  extraReducers: (builder) => {
    // Fetch menu items
    builder
      .addCase(fetchMenuItems.pending, (state) => {
        state.loading.items = true;
        state.error.items = null;
      })
      .addCase(fetchMenuItems.fulfilled, (state, action) => {
        state.loading.items = false;
        state.items = action.payload || [];
      })
      .addCase(fetchMenuItems.rejected, (state, action) => {
        state.loading.items = false;
        state.error.items = action.payload;
      });

    // Fetch categories
    builder
      .addCase(fetchCategories.pending, (state) => {
        state.loading.categories = true;
        state.error.categories = null;
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.loading.categories = false;
        state.categories = action.payload || [];
      })
      .addCase(fetchCategories.rejected, (state, action) => {
        state.loading.categories = false;
        state.error.categories = action.payload;
      });

    // Create menu item
    builder
      .addCase(createMenuItem.pending, (state) => {
        state.loading.action = true;
        state.error.action = null;
      })
      .addCase(createMenuItem.fulfilled, (state, action) => {
        state.loading.action = false;
        state.items.push(action.payload);
        state.success = 'Menu item created successfully';
      })
      .addCase(createMenuItem.rejected, (state, action) => {
        state.loading.action = false;
        state.error.action = action.payload;
      });

    // Update menu item
    builder
      .addCase(updateMenuItem.pending, (state) => {
        state.loading.action = true;
        state.error.action = null;
      })
      .addCase(updateMenuItem.fulfilled, (state, action) => {
        state.loading.action = false;
        const index = state.items.findIndex(i => i._id === action.payload._id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
        state.success = 'Menu item updated successfully';
      })
      .addCase(updateMenuItem.rejected, (state, action) => {
        state.loading.action = false;
        state.error.action = action.payload;
      });

    // Delete menu item
    builder
      .addCase(deleteMenuItem.pending, (state) => {
        state.loading.action = true;
        state.error.action = null;
      })
      .addCase(deleteMenuItem.fulfilled, (state, action) => {
        state.loading.action = false;
        state.items = state.items.filter(i => i._id !== action.payload);
        state.selectedItems = state.selectedItems.filter(id => id !== action.payload);
        state.success = 'Menu item deleted successfully';
      })
      .addCase(deleteMenuItem.rejected, (state, action) => {
        state.loading.action = false;
        state.error.action = action.payload;
      });

    // Toggle availability
    builder
      .addCase(toggleMenuItemAvailability.pending, (state) => {
        state.error.action = null;
      })
      .addCase(toggleMenuItemAvailability.fulfilled, (state, action) => {
        const index = state.items.findIndex(i => i._id === action.payload._id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
      })
      .addCase(toggleMenuItemAvailability.rejected, (state, action) => {
        state.error.action = action.payload;
      });

    // Reorder items
    builder
      .addCase(reorderMenuItems.pending, (state) => {
        state.loading.action = true;
        state.error.action = null;
      })
      .addCase(reorderMenuItems.fulfilled, (state, action) => {
        state.loading.action = false;
        state.items = action.payload;
        state.success = 'Menu items reordered successfully';
      })
      .addCase(reorderMenuItems.rejected, (state, action) => {
        state.loading.action = false;
        state.error.action = action.payload;
      });

    // Bulk toggle availability
    builder
      .addCase(bulkToggleAvailability.pending, (state) => {
        state.loading.action = true;
        state.error.action = null;
      })
      .addCase(bulkToggleAvailability.fulfilled, (state) => {
        state.loading.action = false;
        state.success = 'Items availability updated successfully';
      })
      .addCase(bulkToggleAvailability.rejected, (state, action) => {
        state.loading.action = false;
        state.error.action = action.payload;
      });

    // Bulk delete
    builder
      .addCase(bulkDeleteMenuItems.pending, (state) => {
        state.loading.action = true;
        state.error.action = null;
      })
      .addCase(bulkDeleteMenuItems.fulfilled, (state) => {
        state.loading.action = false;
        state.items = state.items.filter(i => !state.selectedItems.includes(i._id));
        state.selectedItems = [];
        state.success = 'Items deleted successfully';
      })
      .addCase(bulkDeleteMenuItems.rejected, (state, action) => {
        state.loading.action = false;
        state.error.action = action.payload;
      });

    // Bulk assign category
    builder
      .addCase(bulkAssignCategory.pending, (state) => {
        state.loading.action = true;
        state.error.action = null;
      })
      .addCase(bulkAssignCategory.fulfilled, (state) => {
        state.loading.action = false;
        state.selectedItems = [];
        state.success = 'Category assigned successfully';
      })
      .addCase(bulkAssignCategory.rejected, (state, action) => {
        state.loading.action = false;
        state.error.action = action.payload;
      });
  },
});

export const {
  clearError,
  clearSuccess,
  toggleItemSelection,
  selectAllItems,
  clearSelection,
  toggleItemAvailabilityOptimistic,
} = menuSlice.actions;

export default menuSlice.reducer;
