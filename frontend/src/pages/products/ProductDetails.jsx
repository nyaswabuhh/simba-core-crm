import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  Package, 
  DollarSign, 
  Grid,
  FileText,
  Barcode,
  CheckCircle,
  XCircle
} from 'lucide-react';
import EditProductModal from '../../components/modals/EditProductModal';
import DeleteConfirmModal from '../../components/modals/DeleteConfirmModal';

function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    loadProduct();
  }, [id]);

  const loadProduct = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/products/${id}`);
      setProduct(response.data);
    } catch (error) {
      toast.error('Failed to load product details');
      console.error('Error loading product:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await apiClient.delete(`/products/${id}`);
      toast.success('Product deleted successfully');
      navigate('/products');
    } catch (error) {
      if (error.response?.status === 404) {
        toast.error('Product not found');
      } else if (error.response?.status === 403) {
        toast.error('You do not have permission to delete this product');
      } else {
        toast.error(error.response?.data?.detail || 'Failed to delete product');
      }
      console.error('Error deleting product:', error);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getMargin = () => {
    if (!product || !product.cost) return null;
    const price = parseFloat(product.unit_price || 0);
    const cost = parseFloat(product.cost || 0);
    if (cost === 0) return null;
    return ((price - cost) / price * 100).toFixed(2);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">Product not found</p>
        <Link to="/products" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
          Back to Products
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            to="/products"
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <ArrowLeft size={24} />
          </Link>
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Package className="text-blue-600" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
              <p className="text-gray-600 mt-1">{product.product_type || 'Product'}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowEditModal(true)}
            className="btn btn-secondary flex items-center"
          >
            <Edit size={18} className="mr-2" />
            Edit
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="btn btn-danger flex items-center"
          >
            <Trash2 size={18} className="mr-2" />
            Delete
          </button>
        </div>
      </div>

      {/* Status Badge */}
      <div>
        <span className={product.is_active ? 'badge badge-success' : 'badge badge-gray'}>
          {product.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Product Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Product Information */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Product Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start space-x-3">
                <Barcode className="text-gray-400 mt-1" size={20} />
                <div>
                  <p className="text-sm text-gray-600">SKU</p>
                  <p className="text-gray-900 font-mono">{product.sku || '-'}</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Grid className="text-gray-400 mt-1" size={20} />
                <div>
                  <p className="text-sm text-gray-600">Type</p>
                  <span className={product.product_type === 'Product' ? 'badge badge-info' : 'badge badge-warning'}>
                    {product.product_type}
                  </span>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <DollarSign className="text-gray-400 mt-1" size={20} />
                <div>
                  <p className="text-sm text-gray-600">Unit Price</p>
                  <p className="text-2xl font-bold text-gray-900">
                    Ksh{parseFloat(product.unit_price || 0).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <DollarSign className="text-gray-400 mt-1" size={20} />
                <div>
                  <p className="text-sm text-gray-600">Cost</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {product.cost 
                      ? `Ksh${parseFloat(product.cost).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}`
                      : '-'}
                  </p>
                </div>
              </div>

              {/* {getMargin() && (
                <div className="flex items-start space-x-3 md:col-span-2">
                  <TrendingUp className="text-gray-400 mt-1" size={20} />
                  <div>
                    <p className="text-sm text-gray-600">Profit Margin</p>
                    <p className="text-xl font-semibold text-green-600">
                      {getMargin()}%
                    </p>
                  </div>
                </div>
              )} */}
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <FileText size={20} className="mr-2" />
                Description
              </h2>
              <p className="text-gray-700 whitespace-pre-wrap">{product.description}</p>
            </div>
          )}
        </div>

        {/* Right Column - Metadata */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Summary</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <div className="flex items-center mt-1">
                  {product.is_active ? (
                    <>
                      <CheckCircle className="text-green-600 mr-2" size={18} />
                      <span className="text-green-600 font-medium">Active</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="text-gray-400 mr-2" size={18} />
                      <span className="text-gray-600 font-medium">Inactive</span>
                    </>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600">Type</p>
                <p className="text-gray-900 font-medium mt-1">{product.product_type}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Unit Price</p>
                <p className="text-gray-900 font-semibold mt-1">
                  Ksh{parseFloat(product.unit_price || 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </p>
              </div>
              {product.cost && (
                <div>
                  <p className="text-sm text-gray-600">Cost</p>
                  <p className="text-gray-900 font-semibold mt-1">
                    Ksh{parseFloat(product.cost).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </p>
                </div>
              )}
              {getMargin() && (
                <div>
                  <p className="text-sm text-gray-600">Profit Margin</p>
                  <p className="text-green-600 font-semibold mt-1">{getMargin()}%</p>
                </div>
              )}
            </div>
          </div>

          {/* Product Info */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Details</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Product ID</p>
                <p className="text-xs text-gray-900 font-mono mt-1">{product.id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Created</p>
                <p className="text-gray-900 mt-1">{formatDate(product.created_at)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Last Updated</p>
                <p className="text-gray-900 mt-1">{formatDate(product.updated_at)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <EditProductModal
          product={product}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            loadProduct();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <DeleteConfirmModal
          title="Delete Product"
          message={`Are you sure you want to delete "${product.name}"? This action cannot be undone.`}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

export default ProductDetails;