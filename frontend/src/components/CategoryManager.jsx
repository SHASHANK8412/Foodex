import React, { useState } from 'react';
import { Plus, X, Edit2, GripVertical, Loader } from 'lucide-react';
import { Draggable, Droppable, DragDropContext } from 'react-beautiful-dnd';

const CategoryManager = ({
  categories = [],
  selectedCategory = null,
  onSelectCategory,
  onCreateCategory,
  isLoading = false,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [filterText, setFilterText] = useState('');

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;

    await onCreateCategory(newCategoryName);
    setNewCategoryName('');
    setIsCreating(false);
  };

  const filteredCategories = categories.filter(cat =>
    cat.toLowerCase().includes(filterText.toLowerCase())
  );

  const handleDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;
    if (source.index === destination.index) return;

    // Reorder can be handled by parent component if needed
    // For now, we just show the drag functionality
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 px-6 py-4">
        <h3 className="text-lg font-semibold text-gray-900">Categories</h3>
        <p className="text-sm text-gray-600 mt-1">
          Manage menu categories to organize items
        </p>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Search categories..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Create New Category */}
        {!isCreating ? (
          <button
            onClick={() => setIsCreating(true)}
            disabled={isLoading}
            className="w-full px-4 py-2 border border-dashed border-blue-300 rounded-lg hover:bg-blue-50 disabled:bg-gray-100 text-blue-700 disabled:text-gray-500 font-medium text-sm transition inline-flex items-center justify-center gap-2"
          >
            <Plus size={18} />
            Add New Category
          </button>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') handleCreateCategory();
              }}
              placeholder="Category name..."
              autoFocus
              disabled={isLoading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handleCreateCategory}
              disabled={isLoading || !newCategoryName.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition"
            >
              {isLoading ? <Loader size={18} className="animate-spin" /> : 'Save'}
            </button>
            <button
              onClick={() => {
                setIsCreating(false);
                setNewCategoryName('');
              }}
              disabled={isLoading}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 font-medium transition"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* Categories List */}
        {filteredCategories.length > 0 ? (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="categories">
              {(provided, snapshot) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className={`space-y-2 ${snapshot.isDraggingOver ? 'bg-blue-50 rounded p-2' : ''}`}
                >
                  {filteredCategories.map((category, index) => (
                    <Draggable
                      key={category}
                      draggableId={`category-${category}`}
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`flex items-center gap-2 px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition ${
                            snapshot.isDragging ? 'shadow-lg bg-white' : ''
                          } ${selectedCategory === category ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}
                        >
                          {/* Drag Handle */}
                          <div
                            {...provided.dragHandleProps}
                            className="text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing flex-shrink-0"
                          >
                            <GripVertical size={16} />
                          </div>

                          {/* Category Name */}
                          <button
                            onClick={() => onSelectCategory(category)}
                            disabled={isLoading}
                            className="flex-1 text-left px-3 py-2 text-gray-900 font-medium hover:text-blue-600 disabled:text-gray-500 transition"
                            title="Click to filter by this category"
                          >
                            {category}
                          </button>

                          {/* Item Count Badge */}
                          <span className="text-xs bg-gray-200 text-gray-700 rounded-full px-2 py-1 font-medium">
                            {/* Item count would come from parent */}
                          </span>

                          {/* Edit Button */}
                          <button
                            className="text-gray-400 hover:text-gray-600 p-2 rounded hover:bg-gray-200 transition"
                            title="Edit category"
                            disabled
                          >
                            <Edit2 size={16} />
                          </button>

                          {/* Delete Button */}
                          <button
                            className="text-gray-400 hover:text-red-600 p-2 rounded hover:bg-red-50 transition"
                            title="Delete category"
                            disabled
                          >
                            <X size={16} />
                          </button>
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
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm">
              {filterText
                ? 'No categories match your search'
                : 'No categories yet. Create one to get started!'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryManager;
