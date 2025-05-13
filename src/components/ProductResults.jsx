const ProductResults = ({ products }) => {
  if (!products || products.length === 0) {
    return null;
  }

  return (
    <div className="products-container">
      <h2>Plywood Products Found:</h2>
      <div className="products-grid">
        {products.map((product, index) => (
          <div key={index} className="product-card">
            <h3>{product.name}</h3>
            <div className="product-details">
              <div className="product-info">
                <div className="info-row">
                  <span className="info-label">Brand:</span>
                  <span className="info-value">{product.brand}</span>
                </div>
                {product.sub_brand && (
                  <div className="info-row">
                    <span className="info-label">Sub-Brand:</span>
                    <span className="info-value">{product.sub_brand}</span>
                  </div>
                )}
                <div className="info-row">
                  <span className="info-label">Thickness:</span>
                  <span className="info-value">{product.thickness}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Type:</span>
                  <span className="info-value">{product.type}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Size:</span>
                  <span className="info-value">{product.size}</span>
                </div>
              </div>
              
              <div className="price-info">
                <div className="price-row">
                  <span className="price-label">Selling Price:</span>
                  <span className="price-value">{product.selling_price}</span>
                </div>
                <div className="price-row">
                  <span className="price-label">Market Price:</span>
                  <span className="price-value">{product.market_price}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductResults; 