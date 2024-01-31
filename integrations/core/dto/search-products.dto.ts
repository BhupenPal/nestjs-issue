interface Image {
  url: string;
  width: number;
  height: number;
  default: boolean;
  _id: string;
}

interface Detail {
  key: string;
  value: string;
}

interface AdditionalInfo {
  info: string;
  _id: string;
}

interface Seller {
  name: string;
  _id: string;
  data: any[]; // You can specify the actual type for "data" if you have more information about it
  sku: string;
  sellerInventory: boolean;
  inventory: any[]; // You can specify the actual type for "inventory" if you have more information about it
  hsn: number;
  gst: number;
  unavailable: boolean;
  managed: boolean;
  deleted: boolean;
  status: string;
}

interface VariationMap {
  Quantity: string[];
}

export interface Product {
  product_id: string;
  name: string;
  category: string[];
  subCategory: string[];
  subCategoryFilters: Record<string, string[]>;
  images: Image[];
  mrp: number;
  details: Detail[];
  additionalInfo: AdditionalInfo[];
  imageDetails: any[]; // You can specify the actual type for "imageDetails" if you have more information about it
  isParent: boolean;
  searchable: boolean;
  variation: string;
  variationMap: VariationMap;
  tags: string[];
  release: any[]; // You can specify the actual type for "release" if you have more information about it
  socialOrderType: any[]; // You can specify the actual type for "socialOrderType" if you have more information about it
  multiProductTags: any[]; // You can specify the actual type for "multiProductTags" if you have more information about it
  status: string;
  deleted: boolean;
  sellers: Seller[];
  account: string;
  updatedAt: string;
  createdAt: string;
  _id: string;
  href: string;
}

export type SearchProducts = {
  size: number;
  aggregation: boolean;
  page: number;
  total: number;
  products: Product[];
};
