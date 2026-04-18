import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { menuItemSchema } from '../validators/menuValidator';
import ImageUploadSection from './ImageUploadSection';

const AddEditItemModal = ({
  isOpen,
  onClose,
  onSubmit,
  item = null,
  categories = [],
  isLoading = false,
}) => {
  const [preview, setPreview] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showNutritionAccordion, setShowNutritionAccordion] = useState(false);
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(menuItemSchema),
    defaultValues: {
      name: '',
      description: '',
      category: '',
      price: 0,
      discountedPrice: '',
      tags: [],
      isVeg: false,
      isFeatured: false,
      spiceLevel: 'medium',
      prepTime: 0,
      nutritionInfo: {
        calories: '',
        protein: '',
        carbs: '',
      },
    },
  });

  const discountedPrice = watch('discountedPrice');
  const price = watch('price');
  const discount = price && discountedPrice 
    ? Math.round(((price - discountedPrice) / price) * 100)
    : 0;

  // Populate form when editing
  useEffect(() => {
    if (item) {
      reset({
        name: item.name,
        description: item.description || '',
        category: item.category,
        price: item.price,
        discountedPrice: item.discountedPrice || '',
        isVeg: item.isVeg,
        isFeatured: item.isFeatured,
        spiceLevel: item.spiceLevel || 'medium',
        prepTime: item.prepTime || 0,
        nutritionInfo: item.nutritionInfo || {},
      });
      setTags(item.tags || []);
      if (item.image?.url) {
        setPreview(item.image.url);
      }
    } else {
      reset();
      setTags([]);
      setPreview(null);
    }
    setSelectedImage(null);
  }, [item, isOpen, reset]);

  const handleImageSelect = (file, dataUrl) => {
    setSelectedImage(file);
    setPreview(dataUrl);
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      const newTags = [...tags, tagInput.trim()];
      setTags(newTags);
      setValue('tags', newTags);
      setTagInput('');
    }
  };

  const handleRemoveTag = (index) => {
    const newTags = tags.filter((_, i) => i !== index);
    setTags(newTags);
    setValue('tags', newTags);
  };

  const handleFormSubmit = async (data) => {
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('description', data.description || '');
    formData.append('category', data.category);
    formData.append('price', data.price);
    formData.append('discountedPrice', data.discountedPrice || '');
    formData.append('tags', JSON.stringify(tags));
    formData.append('isVeg', data.isVeg);
    formData.append('isFeatured', data.isFeatured);
    formData.append('spiceLevel', data.spiceLevel);
    formData.append('prepTime', data.prepTime);

    if (data.nutritionInfo?.calories || data.nutritionInfo?.protein || data.nutritionInfo?.carbs) {
      formData.append('nutritionInfo', JSON.stringify({
        calories: data.nutritionInfo.calories || null,
        protein: data.nutritionInfo.protein || null,
        carbs: data.nutritionInfo.carbs || null,
      }));
    }

    if (selectedImage) {
      formData.append('image', selectedImage);
    }

    await onSubmit(formData);
  };

  if (!isOpen) return null;

  return (
    <>
      <Toaster position="top-right" />
      
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-20"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-white shadow-lg z-30 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {item ? 'Edit Menu Item' : 'Add New Menu Item'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit(handleFormSubmit)} className="p-6 space-y-6">
          
          {/* Image Upload */}
          <ImageUploadSection
            onImageSelect={handleImageSelect}
            currentImage={item?.image?.url}
            preview={preview}
            isLoading={isLoading}
          />

          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Item Name *
              </label>
              <input
                {...register('name')}
                type="text"
                placeholder="e.g., Margherita Pizza"
                disabled={isLoading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
              />
              {errors.name && (
                <p className="text-red-600 text-sm mt-1">{errors.name.message}</p>
              )}
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category *
              </label>
              <div className="flex gap-2">
                <input
                  {...register('category')}
                  type="text"
                  placeholder="Type or select..."
                  disabled={isLoading}
                  list="categories-list"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                />
                <datalist id="categories-list">
                  {categories.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>
              {errors.category && (
                <p className="text-red-600 text-sm mt-1">{errors.category.message}</p>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              {...register('description')}
              placeholder="Item description..."
              disabled={isLoading}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            />
            {errors.description && (
              <p className="text-red-600 text-sm mt-1">{errors.description.message}</p>
            )}
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price (₹) *
              </label>
              <input
                {...register('price', { valueAsNumber: true })}
                type="number"
                step="0.01"
                placeholder="0.00"
                disabled={isLoading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
              />
              {errors.price && (
                <p className="text-red-600 text-sm mt-1">{errors.price.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Discounted Price (₹)
              </label>
              <div className="flex gap-2">
                <input
                  {...register('discountedPrice', { valueAsNumber: true })}
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  disabled={isLoading}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                />
                {discount > 0 && (
                  <span className="flex items-center px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-green-700 font-semibold text-sm">
                    {discount}% OFF
                  </span>
                )}
              </div>
              {errors.discountedPrice && (
                <p className="text-red-600 text-sm mt-1">{errors.discountedPrice.message}</p>
              )}
            </div>
          </div>

          {/* Properties */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {/* Veg Toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                {...register('isVeg')}
                type="checkbox"
                disabled={isLoading}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm font-medium text-gray-700">Vegetarian</span>
            </label>

            {/* Featured Toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                {...register('isFeatured')}
                type="checkbox"
                disabled={isLoading}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm font-medium text-gray-700">Featured</span>
            </label>

            {/* Spice Level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Spice Level
              </label>
              <select
                {...register('spiceLevel')}
                disabled={isLoading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
              >
                <option value="mild">Mild</option>
                <option value="medium">Medium</option>
                <option value="hot">Hot</option>
              </select>
            </div>
          </div>

          {/* Prep Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prep Time (minutes)
            </label>
            <input
              {...register('prepTime', { valueAsNumber: true })}
              type="number"
              min="0"
              max="240"
              placeholder="30"
              disabled={isLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            />
            {errors.prepTime && (
              <p className="text-red-600 text-sm mt-1">{errors.prepTime.message}</p>
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Type a tag and press Enter"
                disabled={isLoading}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
              />
              <button
                type="button"
                onClick={handleAddTag}
                disabled={isLoading || !tagInput.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition font-medium"
              >
                Add
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(index)}
                      disabled={isLoading}
                      className="hover:text-blue-900"
                    >
                      <X size={16} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Nutrition Accordion */}
          <div className="border border-gray-200 rounded-lg">
            <button
              type="button"
              onClick={() => setShowNutritionAccordion(!showNutritionAccordion)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 font-medium text-gray-900"
            >
              Nutrition Information
              <span className={`transform transition-transform ${showNutritionAccordion ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>
            {showNutritionAccordion && (
              <div className="px-4 py-3 border-t border-gray-200 space-y-3 bg-gray-50">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Calories (kcal)
                  </label>
                  <input
                    {...register('nutritionInfo.calories', { valueAsNumber: true })}
                    type="number"
                    min="0"
                    placeholder="0"
                    disabled={isLoading}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Protein (g)
                    </label>
                    <input
                      {...register('nutritionInfo.protein', { valueAsNumber: true })}
                      type="number"
                      min="0"
                      placeholder="0"
                      disabled={isLoading}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Carbs (g)
                    </label>
                    <input
                      {...register('nutritionInfo.carbs', { valueAsNumber: true })}
                      type="number"
                      min="0"
                      placeholder="0"
                      disabled={isLoading}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 sticky bottom-0 bg-white border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 font-medium text-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition"
            >
              {isLoading ? 'Saving...' : item ? 'Update Item' : 'Create Item'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default AddEditItemModal;
