# API 迁移参考

> 从旧微信原生小程序 `utils/api.js` 提取的完整 API 映射表。
> 用于迁移 14 个占位页面时参考。

## 云函数 → REST API 映射

| 云函数名 | REST 方法 | REST 路径 | 参数转换 |
|---------|----------|----------|---------|
| `login` / `wxLogin` | POST | `/auth/wx-login` | - |
| `merchantLogin` | POST | `/auth/merchant-login` | - |
| `getProducts` | GET | `/products` | categoryId, pageSize, status, keyword |
| `getProductDetail` | GET | `/products/:productId` | - |
| `addProduct` | POST | `/products` | name, categoryId, pricingType, sellingPoint, description, images, deliveryModes, pricePerJin, weightOptions, processingFee, processingOptions, unitPrice, specs |
| `updateProduct` | PUT | `/products/:productId` | 同上 |
| `updateProductStatus` | PATCH | `/products/:productId/status` | status, outOfStock |
| `addCategory` | POST | `/categories` | - |
| `deleteCategory` | DELETE | `/categories/:categoryId` | - |
| `updateCategorySort` | PUT | `/categories/sort` | sorts: [{id, sort}] |
| `getBanners` | GET | `/store/banners` | - |
| `saveBanners` | PUT | `/store/banners` | banners: [...] |
| `getOrders` | GET | `/orders` | status, pageSize |
| `getOrderDetail` | GET | `/orders/:orderNo` | - |
| `createOrder` | POST | `/orders` | - |
| `retryPayment` | POST | `/orders/:orderNo/pay` | - |
| `cancelOrder` | POST | `/orders/:orderNo/cancel` | - |
| `getMerchantOrders` | GET | `/merchant/orders` | status, type, dateFrom, dateTo, pageSize |
| `createOfflineOrder` | POST | `/merchant/offline-orders` | - |
| `updateOrderStatus` | POST | `/merchant/orders/:orderNo/:action` | - |
| `completeOrder` | POST | `/merchant/orders/:orderNo/complete` | - |
| `getPaiNumbers` | GET | `/pai-numbers` | - |
| `getStoreConfig` | GET | `/store` | - |
| `updateStoreConfig` | PUT | `/store` | - |
| `getDashboard` | GET | `/dashboard` | - |
| `addAddress` | POST | `/addresses` | - |
| `updateAddress` | PUT | `/addresses/:addressId` | - |
| `deleteAddress` | DELETE | `/addresses/:addressId` | - |
| `getPickupStatus` | GET | `/pickup/status/:orderNo` | - |
| `releaseTag` | POST | `/pai-numbers/:number/release` | - |
| `refundOrder` | POST | `/merchant/orders/:orderNo/refund` | - |
| `submitWeigh` | POST | `/merchant/orders/:orderNo/weigh` | - |
| `getCardCode` | GET | `/pai-numbers/:cardNumber/code` | - |
| `mockPay` | POST | `/orders/:orderNo/pay` | mockPay: true |
| `clearMockOrders` | POST | `/dev/clear-mock-orders` | - |
| `clearTestData` | POST | `/dev/clear-test-data` | - |

## 参数转换细节

### Products 查询 (mapProductQuery)
- `action: 'categories'` → 路径改为 `/categories`
- `categoryId` → 直接传递
- `pageSize` → 直接传递
- `status` → 直接传递
- `keyword` → 直接传递

### Products 编辑 (mapProductPayload)
- 所有字段可选传递：name, categoryId, pricingType, sellingPoint, description, images, deliveryModes, pricePerJin, weightOptions, processingFee, processingOptions, unitPrice, specs

### Orders 查询 (mapOrderQuery)
- `filter: 'completed'` → `status: 'completed,cancelled'`

### Merchant Orders 查询 (mapMerchantOrderQuery)
- status, type, dateFrom, dateTo, pageSize → 直接传递
