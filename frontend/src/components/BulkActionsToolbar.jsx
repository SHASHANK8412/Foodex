import React, { useState } from 'react';
import { Trash2, ToggleLeft, ToggleRight, FolderPlus, MinusCircle, X } from 'lucide-react';

const BulkActionsToolbar = ({
  selectedCount = 0,
  onDelete,
  onToggleAvailability,
  onAssignCategory,
  categories = [],
  isLoading = false,
  onClose,
}) => {
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');

  if (selectedCount === 0) return null;

  const handleAssignCategory = (category) => {
    onAssignCategory(category);
    setSelectedCategory('');
    setShowCategoryDropdown(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-10 animate-slideup">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          
          {/* Summary */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">
              <span className="font-bold text-blue-600">{selectedCount}</span> item(s) selected
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            
            {/* Toggle Availability */}
            <div className="flex gap-1">
              <button
                onClick={() => onToggleAvailability(true)}
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-3 py-2 bg-green-50 hover:bg-green-100 disabled:bg-gray-100 text-green-700 disabled:text-gray-500 rounded-lg font-medium text-sm transition"
                title="Mark selected items as available"
              >
                <ToggleRight size={18} />
                Enable
              </button>
              <button
                onClick={() => onToggleAvailability(false)}
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-3 py-2 bg-orange-50 hover:bg-orange-100 disabled:bg-gray-100 text-orange-700 disabled:text-gray-500 rounded-lg font-medium text-sm transition"
                title="Mark selected items as unavailable"
              >
                <ToggleLeft size={18} />
                Disable
              </button>
            </div>

            {/* Assign Category Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-3 py-2 bg-purple-50 hover:bg-purple-100 disabled:bg-gray-100 text-purple-700 disabled:text-gray-500 rounded-lg font-medium text-sm transition"
                title="Assign category to selected items"
              >
                <FolderPlus size={18} />
                Category
              </button>
              
              {showCategoryDropdown && (
                <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-48">
                  {categories.length > 0 ? (
                    <div className="max-h-48 overflow-y-auto">
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => handleAssignCategory(cat)}
                          className="w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-700 text-sm"
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-2 text-gray-500 text-sm">
                      No categories available
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Delete */}
            <button
              onClick={() => {
                if (window.confirm(`Delete ${selectedCount} item(s)? This action cannot be undone.`)) {
                  onDelete();
                }
              }}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 disabled:bg-gray-100 text-red-700 disabled:text-gray-500 rounded-lg font-medium text-sm transition"
              title="Delete selected items"
            >
              <Trash2 size={18} />
              Delete
            </button>

            {/* Clear Selection */}
            <button
              onClick={onClose}
              className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm transition"
              title="Clear selection"
            >
              <MinusCircle size={18} />
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Close button for mobile */}
      <button
        onClick={onClose}
        className="md:hidden absolute top-2 right-2 text-gray-500 hover:text-gray-700"
      >
        <X size={20} />
      </button>
    </div>
  );
};

export default BulkActionsToolbar;
