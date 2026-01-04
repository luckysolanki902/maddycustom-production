// Data Query Agent - Handles product search, order tracking, category browsing
import { Agent, tool } from '@openai/agents';
import { z } from 'zod';
import { PROMPTS, TOOL_DESCRIPTIONS } from '../config/prompts.js';
import { MODEL_CONFIGS } from '../config/models.js';
import { LIMITS } from '../config/constants.js';

// Tool parameter schemas
const SearchProductsParams = z.object({
  query: z.string().optional().describe('Free-form search query'),
  keywords: z.array(z.string()).optional().describe('Specific keywords to match'),
  categoryTitle: z.string().optional().describe('Category to filter by'),
  minPrice: z.number().optional().describe('Minimum price in INR'),
  maxPrice: z.number().optional().describe('Maximum price in INR'),
  sortBy: z.enum(['price_asc', 'price_desc', 'popular', 'newest']).optional(),
  page: z.number().optional().default(1),
  limit: z.number().optional().default(LIMITS.DEFAULT_PAGE_SIZE),
  diversifyCategories: z.boolean().optional().describe('Return products from multiple categories'),
});

const GetOrderStatusParams = z.object({
  orderId: z.string().optional().describe('The order ID to track'),
  phone: z.string().optional().describe('Phone number to look up orders'),
});

const BrowseCategoriesParams = z.object({
  parentCategory: z.string().optional().describe('Parent category to list subcategories of'),
});

// Tool implementations
const searchProductsTool = tool({
  name: 'search_products',
  description: TOOL_DESCRIPTIONS.SEARCH_PRODUCTS,
  parameters: SearchProductsParams,
  async execute(params, runContext) {
    try {
      // Dynamic import to avoid SSR issues
      const { searchProducts } = await import('@/lib/assistant/productSearch');
      
      const result = await searchProducts({
        query: params.query,
        keywords: params.keywords,
        categoryTitle: params.categoryTitle,
        minPrice: params.minPrice,
        maxPrice: params.maxPrice,
        sortBy: params.sortBy,
        page: params.page || 1,
        limit: Math.min(params.limit || LIMITS.DEFAULT_PAGE_SIZE, LIMITS.MAX_PAGE_SIZE),
        diversifyCategories: params.diversifyCategories,
      });
      
      // Update context with pagination state
      if (runContext?.context) {
        runContext.context.paginationState = {
          query: params.query || '',
          categoryTitle: params.categoryTitle,
          filters: {
            minPrice: params.minPrice,
            maxPrice: params.maxPrice,
            keywords: params.keywords,
          },
          currentPage: params.page || 1,
          pageSize: params.limit || LIMITS.DEFAULT_PAGE_SIZE,
          totalResults: result.total || 0,
          hasMore: result.hasMore || false,
        };
      }
      
      // Format result for LLM consumption
      const products = result.products || [];
      if (products.length === 0) {
        return JSON.stringify({
          success: true,
          message: 'No products found matching your criteria.',
          products: [],
          hasMore: false,
        });
      }
      
      // Simplified product format for LLM
      const simplified = products.map((p) => ({
        id: p._id || p.id,
        name: p.title || p.name,
        price: p.price,
        originalPrice: p.originalPrice,
        category: p.categoryTitle || p.category,
        image: p.image || p.mainImage,
        slug: p.slug,
        inStock: p.inStock !== false,
      }));
      
      return JSON.stringify({
        success: true,
        products: simplified,
        total: result.total,
        page: params.page || 1,
        hasMore: result.hasMore || false,
        queryEcho: {
          query: params.query,
          category: params.categoryTitle,
          priceRange: params.minPrice || params.maxPrice ? 
            `₹${params.minPrice || 0} - ₹${params.maxPrice || '∞'}` : null,
        },
      });
    } catch (error) {
      console.error('[searchProducts] Error:', error);
      return JSON.stringify({
        success: false,
        error: 'Failed to search products. Please try again.',
      });
    }
  },
});

const getOrderStatusTool = tool({
  name: 'get_order_status',
  description: TOOL_DESCRIPTIONS.GET_ORDER_STATUS,
  parameters: GetOrderStatusParams,
  async execute(params) {
    try {
      const { getOrderStatus } = await import('@/lib/assistant/orderStatus');
      
      if (!params.orderId && !params.phone) {
        return JSON.stringify({
          success: false,
          error: 'Please provide either an order ID or phone number to track your order.',
        });
      }
      
      const result = await getOrderStatus({
        orderId: params.orderId,
        phone: params.phone,
      });
      
      if (!result.ok) {
        return JSON.stringify({
          success: false,
          error: result.error || 'Unable to find order with provided details.',
        });
      }
      
      return JSON.stringify({
        success: true,
        orderId: result.orderId,
        status: result.status,
        expectedDelivery: result.expectedDelivery,
        trackUrl: result.trackUrl,
        steps: result.steps,
        lookup: result.lookup,
      });
    } catch (error) {
      console.error('[getOrderStatus] Error:', error);
      return JSON.stringify({
        success: false,
        error: 'Failed to fetch order status. Please try again.',
      });
    }
  },
});

const browseCategoriesTool = tool({
  name: 'browse_categories',
  description: TOOL_DESCRIPTIONS.BROWSE_CATEGORIES,
  parameters: BrowseCategoriesParams,
  async execute(params) {
    try {
      const { categoryFirstSuggestions } = await import('@/lib/assistant/productSearch');
      
      const result = await categoryFirstSuggestions({
        parentCategory: params.parentCategory,
      });
      
      return JSON.stringify({
        success: true,
        categories: result.categories || [],
        parentCategory: params.parentCategory || 'all',
      });
    } catch (error) {
      console.error('[browseCategories] Error:', error);
      return JSON.stringify({
        success: false,
        error: 'Failed to load categories. Please try again.',
      });
    }
  },
});

/**
 * Create the Data Query Agent
 * @returns {Agent}
 */
export function createDataQueryAgent() {
  return new Agent({
    name: 'DataQueryAgent',
    instructions: PROMPTS.DATA_QUERY_AGENT,
    model: MODEL_CONFIGS.dataQuery.name,
    modelSettings: {
      temperature: MODEL_CONFIGS.dataQuery.temperature,
    },
    tools: [searchProductsTool, getOrderStatusTool, browseCategoriesTool],
  });
}

/**
 * Run the Data Query Agent
 * @param {string} message
 * @param {object} context
 * @returns {Promise<object>}
 */
export async function runDataQueryAgent(message, context) {
  const { run } = await import('@openai/agents');
  const agent = createDataQueryAgent();
  
  const result = await run(agent, message, {
    context,
  });
  
  // Extract structured data from tool results if available
  let products;
  let orderStatus;
  let hasMore = false;
  
  // Parse final output or tool results
  const output = result.finalOutput;
  
  // Check pagination state from context
  if (context.paginationState) {
    hasMore = context.paginationState.hasMore;
    products = context.lastProductResults;
  }
  
  return {
    text: typeof output === 'string' ? output : JSON.stringify(output),
    products,
    orderStatus,
    hasMore,
  };
}
