import { z } from 'zod';

// Menu item validation schema
export const menuItemSchema = z.object({
  name: z.string()
    .min(1, 'Menu item name is required')
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters'),
  
  description: z.string()
    .max(500, 'Description must not exceed 500 characters')
    .optional()
    .or(z.literal('')),
  
  category: z.string()
    .min(1, 'Category is required')
    .min(2, 'Category must be at least 2 characters')
    .max(50, 'Category must not exceed 50 characters'),
  
  price: z.number()
    .min(0, 'Price cannot be negative')
    .min(0.01, 'Price must be greater than 0'),
  
  discountedPrice: z.number()
    .min(0, 'Discounted price cannot be negative')
    .optional()
    .refine(
      (val) => !val || val > 0,
      'Discounted price must be greater than 0'
    ),
  
  tags: z.array(
    z.string()
      .min(1, 'Tag cannot be empty')
      .max(30, 'Tag must not exceed 30 characters')
  )
    .optional()
    .default([]),
  
  isVeg: z.boolean().default(false),
  
  isFeatured: z.boolean().default(false),
  
  spiceLevel: z.enum(['mild', 'medium', 'hot']).default('medium'),
  
  prepTime: z.number()
    .int('Prep time must be a whole number')
    .min(0, 'Prep time cannot be negative')
    .max(240, 'Prep time must not exceed 240 minutes')
    .optional()
    .default(0),
  
  nutritionInfo: z.object({
    calories: z.number()
      .min(0, 'Calories cannot be negative')
      .optional(),
    protein: z.number()
      .min(0, 'Protein cannot be negative')
      .optional(),
    carbs: z.number()
      .min(0, 'Carbs cannot be negative')
      .optional(),
  })
    .optional()
    .default({}),
  
  image: z.instanceof(File)
    .refine(
      (file) => file.size <= 5 * 1024 * 1024,
      'Image must not exceed 5MB'
    )
    .refine(
      (file) => ['image/jpeg', 'image/png'].includes(file.type),
      'Image must be JPEG or PNG'
    )
    .optional(),
});

// Bulk category assignment schema
export const bulkCategorySchema = z.object({
  category: z.string()
    .min(1, 'Category is required')
    .min(2, 'Category must be at least 2 characters')
    .max(50, 'Category must not exceed 50 characters'),
});

// Bulk toggle availability schema
export const bulkToggleSchema = z.object({
  isAvailable: z.boolean(),
});

// Category creation schema
export const categorySchema = z.object({
  name: z.string()
    .min(1, 'Category name is required')
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must not exceed 50 characters'),
});

// Reorder schema
export const reorderSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1, 'Item ID is required'),
      sortOrder: z.number().int().min(0),
    })
  ),
});

// Export types (for documentation purposes - use JSDoc comments in actual code)
/**
 * @typedef {z.infer<typeof menuItemSchema>} MenuItem
 * @typedef {z.infer<typeof bulkCategorySchema>} BulkCategory
 * @typedef {z.infer<typeof bulkToggleSchema>} BulkToggle
 * @typedef {z.infer<typeof categorySchema>} Category
 * @typedef {z.infer<typeof reorderSchema>} ReorderItems
 */
