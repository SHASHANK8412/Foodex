import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Toaster, toast } from 'sonner';
import { Edit2, Trash2, ToggleRight, ToggleLeft, Plus, ChevronRight, Loader } from 'lucide-react';

import {
  fetchMenuItems,
  fetchCategories,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  reorderMenuItems,
  bulkToggleAvailability,
  bulkDeleteMenuItems,
  bulkAssignCategory,
  toggleItemSelection,
  selectAllItems,
  clearSelection,
  toggleMenuItemAvailability,
  clearError,
  clearSuccess,
} from '../redux/slices/menuSlice';

import AddEditItemModal from '../components/AddEditItemModal';
import BulkActionsToolbar from '../components/BulkActionsToolbar';
import CategoryManager from '../components/CategoryManager';

const MenuDashboard = () => {
  const dispatch = useDispatch();
  const { restaurantId } = useParams();

  const {
    items,
    categories,
    selectedItems,
    loading,
    error,
    success,
  } = useSelector((state) => state.menu);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterAvailability, setFilterAvailability] = useState('all');

  // Initial load
  useEffect(() => {
    if (restaurantId) {
      dispatch(fetchMenuItems({ restaurantId }));
      dispatch(fetchCategories({ restaurantId }));
    }
  }, [dispatch, restaurantId]);

  // Show success/error toast
  useEffect(() => {
    if (success) {
      toast.success(success);
      dispatch(clearSuccess());
    }
  }, [success, dispatch]);

  useEffect(() => {
    if (error.action || error.items) {
      toast.error(error.action || error.items);
      dispatch(clearError());
    }
  }, [error, dispatch]);

  const handleCreateItem = () => {
    setSelectedItem(null);
    setIsModalOpen(true);
  };

  const handleEditItem = (item) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  const handleModalSubmit = async (formData) => {
    if (selectedItem) {
      await dispatch(updateMenuItem({
        restaurantId,
        itemId: selectedItem._id,
        formData,
      }));
    } else {
      await dispatch(createMenuItem({
        restaurantId,
        formData,
      }));
    }
    setIsModalOpen(false);
  };

  const handleDeleteItem = (itemId) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      dispatch(deleteMenuItem({ restaurantId, itemId }));
    }
  };

  const handleToggleItem = (itemId) => {
    dispatch(toggleItemSelection(itemId));
  };

  const handleSelectAll = () => {
    if (selectedItems.length === filteredItems.length) {
      dispatch(clearSelection());
    } else {
      dispatch(selectAllItems());
    }
  };

  const handleDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination || source.index === destination.index) return;

    const reorderedItems = Array.from(filteredItems);
    const [movedItem] = reorderedItems.splice(source.index, 1);
    reorderedItems.splice(destination.index, 0, movedItem);

    const itemsWithOrder = reorderedItems.map((item, idx) => ({
      id: item._id,
      sortOrder: idx,
    }));

    dispatch(reorderMenuItems({ restaurantId, items: itemsWithOrder }));
  };

  // Filter items
  let filteredItems = items;
  if (filterCategory) {
    filteredItems = filteredItems.filter(item => item.category === filterCategory);
  }
  if (filterAvailability !== 'all') {
    filteredItems = filteredItems.filter(
      item => item.isAvailable === (filterAvailability === 'available')
    );
  }

  const isAllSelected = selectedItems.length === filteredItems.length && filteredItems.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Menu Management</h1>
              <p className="text-gray-600 mt-1">Manage your restaurant menu items</p>
            </div>
            <button
              onClick={handleCreateItem}
              disabled={loading.action}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition"
            >
              <Plus size={18} />
              Add Item
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Sidebar - Category Manager */}
          <div className="lg:col-span-1">
            <CategoryManager
              categories={categories}
              selectedCategory={filterCategory}
              onSelectCategory={(cat) => setFilterCategory(cat)}
              isLoading={loading.categories}
            />
          </div>

          {/* Main Content - Menu Grid */}
          <div className="lg:col-span-3 space-y-4">
            
            {/* Filters */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between flex-wrap gap-4">
              {/* Category Filter */}
              {filterCategory && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Filtering by:</span>
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                    {filterCategory}
                    <button
                      onClick={() => setFilterCategory('')}
                      className="hover:text-blue-900"
                    >
                      <span className="text-lg">×</span>
                    </button>
                  </span>
                </div>
              )}

              {/* Availability Filter */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Show:</label>
                <select
                  value={filterAvailability}
                  onChange={(e) => setFilterAvailability(e.target.value)}
                  className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Items</option>
                  <option value="available">Available Only</option>
                  <option value="unavailable">Unavailable Only</option>
                </select>
              </div>

              {/* Select All */}
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Select All
                  </span>
                </label>
              </div>
            </div>

            {/* Menu Items Grid */}
            {loading.items ? (
              <div className="flex items-center justify-center py-16">
                <Loader className="animate-spin text-blue-600" size={32} />
              </div>
            ) : filteredItems.length > 0 ? (
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="menu-items">
                  {(provided, snapshot) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${
                        snapshot.isDraggingOver ? 'bg-blue-50 rounded p-4' : ''
                      }`}
                    >
                      {filteredItems.map((item, index) => (
                        <Draggable
                          key={item._id}
                          draggableId={item._id}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition ${
                                snapshot.isDragging ? 'shadow-xl rotate-3' : ''
                              }`}
                            >
                              {/* Image */}
                              <div className="relative h-48 bg-gray-100 overflow-hidden group">
                                {item.image?.url ? (
                                  <img
                                    src={item.image.url}
                                    alt={item.name}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-gray-200">
                                    <span className="text-gray-400">No image</span>
                                  </div>
                                )}

                                {/* Overlay Actions */}
                                <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-40 transition flex items-center justify-center gap-2 opacity-0 hover:opacity-100">
                                  <button
                                    onClick={() => handleEditItem(item)}
                                    className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition"
                                  >
                                    <Edit2 size={18} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteItem(item._id)}
                                    disabled={loading.action}
                                    className="p-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-full transition"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>

                                {/* Badges */}
                                <div className="absolute top-2 right-2 flex gap-2">
                                  {item.isFeatured && (
                                    <span className="px-2 py-1 bg-yellow-500 text-white text-xs font-semibold rounded">
                                      Featured
                                    </span>
                                  )}
                                  {item.isVeg && (
                                    <span className="px-2 py-1 bg-green-500 text-white text-xs font-semibold rounded">
                                      Veg
                                    </span>
                                  )}
                                </div>

                                {/* Selection Checkbox */}
                                <label className="absolute top-2 left-2 flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={selectedItems.includes(item._id)}
                                    onChange={() => handleToggleItem(item._id)}
                                    className="w-5 h-5 rounded border-gray-300"
                                  />
                                </label>
                              </div>

                              {/* Content */}
                              <div className="p-4 space-y-3">
                                
                                {/* Name & Category */}
                                <div>
                                  <h3 className="font-semibold text-gray-900 truncate">
                                    {item.name}
                                  </h3>
                                  <p className="text-xs text-gray-500">{item.category}</p>
                                </div>

                                {/* Price */}
                                <div className="flex items-baseline gap-2">
                                  <span className="text-lg font-bold text-gray-900">
                                    ₹{item.price.toFixed(2)}
                                  </span>
                                  {item.discountedPrice && (
                                    <>
                                      <span className="text-sm line-through text-gray-500">
                                        ₹{item.discountedPrice.toFixed(2)}
                                      </span>
                                    </>
                                  )}
                                </div>

                                {/* Meta Info */}
                                <div className="flex items-center justify-between text-xs text-gray-500">
                                  <span>{item.spiceLevel}</span>
                                  <span>{item.prepTime}m prep</span>
                                </div>

                                {/* Description */}
                                {item.description && (
                                  <p className="text-sm text-gray-600 line-clamp-2">
                                    {item.description}
                                  </p>
                                )}

                                {/* Tags */}
                                {item.tags?.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {item.tags.slice(0, 2).map((tag) => (
                                      <span
                                        key={tag}
                                        className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                    {item.tags.length > 2 && (
                                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                                        +{item.tags.length - 2}
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* Availability Toggle */}
                                <button
                                  onClick={() =>
                                    dispatch(
                                      toggleMenuItemAvailability({
                                        restaurantId,
                                        itemId: item._id,
                                      })
                                    )
                                  }
                                  disabled={loading.action}
                                  className={`w-full py-2 rounded-lg font-medium text-sm transition flex items-center justify-center gap-2 ${
                                    item.isAvailable
                                      ? 'bg-green-50 hover:bg-green-100 disabled:bg-gray-100 text-green-700'
                                      : 'bg-orange-50 hover:bg-orange-100 disabled:bg-gray-100 text-orange-700'
                                  }`}
                                >
                                  {item.isAvailable ? (
                                    <>
                                      <ToggleRight size={16} />
                                      Available
                                    </>
                                  ) : (
                                    <>
                                      <ToggleLeft size={16} />
                                      Unavailable
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            ) : (
              <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
                <p className="text-gray-500 text-lg">
                  {filterCategory || filterAvailability !== 'all'
                    ? 'No items match your filters'
                    :  'No menu items yet. Create one to get started!'}
                </p>
                {!filterCategory && filterAvailability === 'all' && (
                  <button
                    onClick={handleCreateItem}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
                  >
                    <Plus size={18} />
                    Add First Item
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bulk Actions Toolbar */}
      {selectedItems.length > 0 && (
        <BulkActionsToolbar
          selectedCount={selectedItems.length}
          onDelete={() => dispatch(bulkDeleteMenuItems({ restaurantId, itemIds: selectedItems }))}
          onToggleAvailability={(isAvailable) =>
            dispatch(bulkToggleAvailability({ restaurantId, itemIds: selectedItems, isAvailable }))
          }
          onAssignCategory={(category) => {
            dispatch(bulkAssignCategory({ restaurantId, itemIds: selectedItems, category }));
          }}
          categories={categories}
          isLoading={loading.action}
          onClose={() => dispatch(clearSelection())}
        />
      )}

      {/* Modal */}
      <AddEditItemModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
        item={selectedItem}
        categories={categories}
        isLoading={loading.action}
      />
    </div>
  );
};

export default MenuDashboard;
