import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  addProduct, 
  updateProduct, 
  archiveProduct, 
  restoreProduct, 
  deleteProductSoft,
  subscribeProducts
} from '../firebase/db';
import type { Product } from '../types';
import { 
  Search, 
  Plus, 
  Trash2, 
  Archive, 
  RotateCcw, 
  Copy, 
  Download, 
  Upload, 
  Printer, 
  X, 
  Edit3, 
  AlertTriangle,
  UploadCloud
} from 'lucide-react';
import { toast } from 'sonner';
import dayjs from 'dayjs';

// --- CODE 39 BARCODE SVG GENERATOR ---
const CODE39_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%*";
const CODE39_PATTERNS = [
  "000110100", "100100001", "001100001", "101100000", "000110001", // 0-4
  "100110000", "001110000", "000100101", "100010100", "001010100", // 5-9
  "100001001", "001001001", "101001000", "000011001", "100011000", // A-E
  "001011000", "000001101", "100001100", "001001100", "000011100", // F-J
  "100000011", "001000011", "101000010", "000010011", "100010010", // K-O
  "001010010", "000000111", "100000110", "001000110", "000010110", // P-T
  "110000001", "011000001", "111000000", "010010001", "110010000", // U-Y
  "011010000", "010000101", "110000100", "011000100", "010101000", // Z, -, ., ' ', $
  "010100010", "010001010", "000101010", "010010100"              // /, +, %, *
];

const compressImageFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose a valid image file.'));
      return;
    }

    const imageUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(imageUrl);

      const maxSide = 900;
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Image processor is not available in this browser.'));
        return;
      }

      ctx.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.78));
    };

    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error('Could not read this image. Try a JPG, PNG, or WebP file.'));
    };

    image.src = imageUrl;
  });
};

const Barcode: React.FC<{ value: string }> = ({ value }) => {
  const encodeText = `*${value.toUpperCase()}*`;
  let svgPaths: JSX.Element[] = [];
  let currentX = 10;
  const narrowWidth = 1.5;
  const wideWidth = 3.5;
  const height = 45;

  for (let i = 0; i < encodeText.length; i++) {
    const char = encodeText[i];
    const index = CODE39_ALPHABET.indexOf(char);
    if (index === -1) continue;

    const pattern = CODE39_PATTERNS[index];
    
    // Pattern describes 9 bars alternating black/white: B, W, B, W, B, W, B, W, B
    for (let j = 0; j < 9; j++) {
      const isWide = pattern[j] === '1';
      const isBlack = j % 2 === 0;
      const width = isWide ? wideWidth : narrowWidth;

      if (isBlack) {
        svgPaths.push(
          <rect 
            key={`${i}-${j}`} 
            x={currentX} 
            y={5} 
            width={width} 
            height={height} 
            fill="black" 
          />
        );
      }
      currentX += width;
    }
    
    // Add 1 narrow white bar as character spacing
    currentX += narrowWidth;
  }

  return (
    <div className="flex flex-col items-center p-2 bg-white border rounded-lg shadow-sm w-fit">
      <svg width={currentX + 10} height={65} className="mx-auto">
        {svgPaths}
        <text 
          x={(currentX + 20) / 2} 
          y={60} 
          textAnchor="middle" 
          className="font-mono text-[10px] font-bold fill-black tracking-[4px]"
        >
          {value}
        </text>
      </svg>
    </div>
  );
};

export const Inventory: React.FC = () => {
  const { currentUser } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStockFilter, setSelectedStockFilter] = useState('All');
  const [sortBy, setSortBy] = useState('name');
  
  // Modal states
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [barcodePrintProduct, setBarcodePrintProduct] = useState<Product | null>(null);


  // Form states
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [category, setCategory] = useState('Dagdusheth Shape');
  const [sellingPrice, setSellingPrice] = useState(0);
  const [quantity, setQuantity] = useState(0);
  const [size, setSize] = useState('2 feet');
  const [weight, setWeight] = useState('10 kg');
  const [material, setMaterial] = useState('Clay / Shadu Mati');
  const [description, setDescription] = useState('');
  const [lowStockLimit, setLowStockLimit] = useState(5);
  const [barcode, setBarcode] = useState('');
  
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Categories & Materials lists
  const categories = ['Dagdusheth Shape', 'Lalbaugcha Raja Shape', 'Peshwa Style', 'Bal Ganesha', 'Traditional', 'Custom Art'];
  const materials = ['Clay / Shadu Mati', 'Plaster of Paris (POP)', 'Paper Pulp Eco', 'Terracotta'];

  // Subscribe to live products
  useEffect(() => {
    const unsubscribe = subscribeProducts(setProducts);
    return () => unsubscribe();
  }, []);

  // Sync edit product form values
  useEffect(() => {
    if (editingProduct) {
      setId(editingProduct.id);
      setName(editingProduct.name);
      setPhotoUrl(editingProduct.photoUrl);
      setCategory(editingProduct.category);
      setSellingPrice(editingProduct.sellingPrice);
      setQuantity(editingProduct.quantity);
      setSize(editingProduct.size);
      setWeight(editingProduct.weight);
      setMaterial(editingProduct.material);
      setDescription(editingProduct.description);
      setLowStockLimit(editingProduct.lowStockLimit);
      setBarcode(editingProduct.barcode);
    } else {
      // Auto generate ID and barcode
      const randomId = 'GP-' + Math.floor(1000 + Math.random() * 9000);
      setId(randomId);
      setName('');
      setPhotoUrl('');
      setCategory('Dagdusheth Shape');
      setSellingPrice(0);
      setQuantity(10);
      setSize('1.5 feet');
      setWeight('5 kg');
      setMaterial('Clay / Shadu Mati');
      setDescription('');
      setLowStockLimit(3);
      setBarcode(randomId);
    }
  }, [editingProduct, formOpen]);

  // Handle Photo Upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      toast.error('Image is too large. Please choose a file under 8 MB.');
      e.target.value = '';
      return;
    }

    setUploadingImage(true);
    try {
      const compressedDataUrl = await compressImageFile(file);
      setPhotoUrl(compressedDataUrl);
      toast.success('Product image added.');
    } catch (err: any) {
      console.error(err);
      toast.error('Image failed: ' + err.message);
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  // Submit Product Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || sellingPrice <= 0 || quantity < 0) {
      toast.error('Please fill in name, selling price, and quantity.');
      return;
    }

    const payload: Product = {
      id: id.trim(),
      name: name.trim(),
      photoUrl: photoUrl.trim(),
      category,
      purchaseCost: editingProduct?.purchaseCost || sellingPrice,
      sellingPrice,
      profit: 0,
      quantity,
      size,
      weight,
      material,
      description: description.trim(),
      lowStockLimit,
      status: editingProduct ? editingProduct.status : 'active',
      createdAt: editingProduct ? editingProduct.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      barcode: barcode.trim() || id.trim()
    };

    try {
      if (editingProduct) {
        await updateProduct(id, payload);
        toast.success('Product updated successfully!');
      } else {
        // Check for ID collision
        const exists = products.find(p => p.id === id);
        if (exists) {
          toast.error('Product with this ID already exists.');
          return;
        }
        await addProduct(payload);
        toast.success('Product created successfully!');
      }
      setFormOpen(false);
      setEditingProduct(null);
    } catch (err: any) {
      toast.error('Save failed: ' + err.message);
    }
  };

  // Duplicate product helper
  const handleDuplicate = async (product: Product) => {
    const newId = 'GP-' + Math.floor(1000 + Math.random() * 9000);
    const duplicated: Product = {
      ...product,
      id: newId,
      name: `${product.name} (Copy)`,
      barcode: newId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await addProduct(duplicated);
      toast.success(`Duplicated into ${duplicated.name}`);
    } catch (e: any) {
      toast.error('Duplication failed: ' + e.message);
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    const headers = 'ID,Name,Category,Material,Size,Weight,SellingPrice,Quantity,LowStockLimit,Barcode,Status\n';
    const rows = products.map(p => 
      `"${p.id}","${p.name}","${p.category}","${p.material}","${p.size}","${p.weight}",${p.sellingPrice},${p.quantity},${p.lowStockLimit},"${p.barcode}","${p.status}"`
    ).join('\n');
    
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ganpati_inventory_${dayjs().format('YYYY-MM-DD')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Catalog exported successfully!');
  };

  // CSV Import
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      // Skip headers
      const dataLines = lines.slice(1);
      
      let importedCount = 0;
      let errorCount = 0;

      for (const line of dataLines) {
        // Simple CSV splitter (regex to respect quotes)
        const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        if (!parts || parts.length < 9) {
          errorCount++;
          continue;
        }

        const clean = (val: string) => val.replace(/^"|"$/g, '');
        const pId = clean(parts[0]);
        const pName = clean(parts[1]);
        const pCat = clean(parts[2]);
        const pMat = clean(parts[3]);
        const pSize = clean(parts[4]);
        const pWeight = clean(parts[5]);
        const pPrice = parseFloat(parts[6]) || 0;
        const pQty = parseInt(parts[7]) || 0;
        const pLimit = parseInt(parts[8]) || 3;
        const pBarcode = clean(parts[9] || '') || pId;

        const productPayload: Product = {
          id: pId,
          name: pName,
          photoUrl: '',
          category: pCat,
          material: pMat,
          size: pSize,
          weight: pWeight,
          purchaseCost: pPrice,
          sellingPrice: pPrice,
          profit: 0,
          quantity: pQty,
          lowStockLimit: pLimit,
          description: '',
          status: 'active',
          barcode: pBarcode,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        try {
          await addProduct(productPayload);
          importedCount++;
        } catch {
          errorCount++;
        }
      }

      toast.success(`Import complete! ${importedCount} items added.`);
      if (errorCount > 0) {
        toast.warning(`${errorCount} rows skipped due to parse errors.`);
      }
    };
    reader.readAsText(file);
  };

  // Barcode Printer trigger
  const handlePrintBarcode = (product: Product) => {
    setBarcodePrintProduct(product);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  // --- FILTERS & SEARCH PIPELINE ---
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.barcode.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    
    let matchesStock = true;
    if (selectedStockFilter === 'Low Stock') {
      matchesStock = p.quantity > 0 && p.quantity <= p.lowStockLimit;
    } else if (selectedStockFilter === 'Out of Stock') {
      matchesStock = p.quantity === 0;
    } else if (selectedStockFilter === 'Archived') {
      matchesStock = p.status === 'archived';
    } else if (selectedStockFilter === 'Active') {
      matchesStock = p.status === 'active';
    }

    return matchesSearch && matchesCategory && matchesStock;
  }).sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'price-asc') return a.sellingPrice - b.sellingPrice;
    if (sortBy === 'price-desc') return b.sellingPrice - a.sellingPrice;
    if (sortBy === 'qty-asc') return a.quantity - b.quantity;
    if (sortBy === 'qty-desc') return b.quantity - a.quantity;
    return 0;
  });

  return (
    <div className="space-y-6 print:hidden">
      {/* Title & Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Inventory Catalog</h2>
          <p className="text-sm text-muted-foreground">Manage Ganpati idols, stocks, barcode printing, and CSV uploads</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Import file input hidden */}
          <input
            type="file"
            accept=".csv"
            onChange={handleImportCSV}
            id="csv-import"
            className="hidden"
          />
          <label
            htmlFor="csv-import"
            className="flex items-center space-x-1 px-4 py-2 border border-border bg-card text-muted-foreground hover:text-foreground text-xs font-semibold rounded-xl cursor-pointer shadow-sm"
          >
            <Upload className="h-4 w-4" />
            <span>Bulk Import</span>
          </label>
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1 px-4 py-2 border border-border bg-card text-muted-foreground hover:text-foreground text-xs font-semibold rounded-xl cursor-pointer shadow-sm"
          >
            <Download className="h-4 w-4" />
            <span>Bulk Export</span>
          </button>
          <button
            onClick={() => { setEditingProduct(null); setFormOpen(true); }}
            className="flex items-center space-x-1 px-4 py-2 bg-saffron hover:bg-saffron-light text-white text-xs font-bold rounded-xl cursor-pointer shadow-md"
          >
            <Plus className="h-4 w-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* --- FILTER & SEARCH BAR --- */}
      <div className="glass p-4 rounded-2xl border border-border flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-2.5 h-4.5 w-4.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by ID, name, barcode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-saffron/30"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 w-full md:w-auto justify-end">
          {/* Category */}
          <div className="flex items-center space-x-1.5 bg-card border border-border px-3 py-1.5 rounded-xl text-xs font-semibold">
            <span className="text-muted-foreground">Category:</span>
            <select 
              value={selectedCategory} 
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent border-none focus:outline-none focus:ring-0 cursor-pointer"
            >
              <option value="All">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Stock filter */}
          <div className="flex items-center space-x-1.5 bg-card border border-border px-3 py-1.5 rounded-xl text-xs font-semibold">
            <span className="text-muted-foreground">Status:</span>
            <select 
              value={selectedStockFilter} 
              onChange={(e) => setSelectedStockFilter(e.target.value)}
              className="bg-transparent border-none focus:outline-none focus:ring-0 cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Low Stock">Low Stock</option>
              <option value="Out of Stock">Out of Stock</option>
              <option value="Archived">Archived</option>
            </select>
          </div>

          {/* Sorting */}
          <div className="flex items-center space-x-1.5 bg-card border border-border px-3 py-1.5 rounded-xl text-xs font-semibold">
            <span className="text-muted-foreground">Sort By:</span>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent border-none focus:outline-none focus:ring-0 cursor-pointer"
            >
              <option value="name">Name (A-Z)</option>
              <option value="price-asc">Price (Low to High)</option>
              <option value="price-desc">Price (High to Low)</option>
              <option value="qty-asc">Stock (Low to High)</option>
              <option value="qty-desc">Stock (High to Low)</option>
            </select>
          </div>
        </div>
      </div>

      {/* --- PRODUCTS TABLE/GRID --- */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-20 bg-card border border-border rounded-2xl flex flex-col items-center justify-center space-y-3">
          <AlertTriangle className="h-10 w-10 text-muted-foreground/35 animate-pulse" />
          <h3 className="font-semibold text-foreground text-base">No Products Found</h3>
          <p className="text-xs text-muted-foreground max-w-xs">No catalog products match your active search terms or filter selections.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((p) => {
            const isLowStock = p.quantity > 0 && p.quantity <= p.lowStockLimit;
            const isOutOfStock = p.quantity === 0;

            return (
              <div 
                key={p.id} 
                className={`bg-card rounded-2xl border ${
                  isOutOfStock 
                    ? 'border-red-500/30 glow-red' 
                    : isLowStock 
                      ? 'border-amber-500/30' 
                      : 'border-border'
                } overflow-hidden shadow-sm flex flex-col group hover:shadow-md transition-all duration-300 relative`}
              >
                {/* Stock badges */}
                <div className="absolute top-3 left-3 z-10">
                  {isOutOfStock ? (
                    <span className="px-2.5 py-1 text-[9px] font-extrabold bg-red-600 text-white rounded-full uppercase shadow">Out Of Stock</span>
                  ) : isLowStock ? (
                    <span className="px-2.5 py-1 text-[9px] font-extrabold bg-amber-500 text-white rounded-full uppercase shadow">Low Stock ({p.quantity})</span>
                  ) : (
                    <span className="px-2.5 py-1 text-[9px] font-bold bg-green-500/10 text-green-500 rounded-full border border-green-500/10">In Stock: {p.quantity}</span>
                  )}
                </div>

                {/* Product Photo */}
                <div className="h-48 bg-muted relative overflow-hidden flex items-center justify-center shrink-0">
                  {p.photoUrl ? (
                    <img 
                      src={p.photoUrl} 
                      alt={p.name} 
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    />
                  ) : (
                    <div className="text-center p-4">
                      <span className="font-bold text-4xl text-muted-foreground/35 uppercase">{p.name[0]}</span>
                      <p className="text-[10px] text-muted-foreground/50 mt-1">No Image Available</p>
                    </div>
                  )}
                  {/* Category overlay */}
                  <span className="absolute bottom-3 right-3 px-2 py-0.5 text-[9px] font-semibold bg-black/60 text-white rounded-md">{p.category}</span>
                </div>

                {/* Product Body */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between">
                      <h4 className="font-bold text-xs text-foreground line-clamp-1 group-hover:text-saffron transition-colors">{p.name}</h4>
                      <span className="text-[10px] text-muted-foreground font-bold">{p.id}</span>
                    </div>
                    
                    <p className="text-[10px] text-muted-foreground line-clamp-2">{p.description || 'No description provided.'}</p>
                    
                    <div className="grid grid-cols-3 gap-2 border-y border-border/60 py-2 text-[10px] text-muted-foreground">
                      <div>
                        <span className="block text-[8px] font-semibold uppercase text-muted-foreground/85">Size</span>
                        <strong className="text-foreground">{p.size}</strong>
                      </div>
                      <div>
                        <span className="block text-[8px] font-semibold uppercase text-muted-foreground/85">Weight</span>
                        <strong className="text-foreground">{p.weight}</strong>
                      </div>
                      <div>
                        <span className="block text-[8px] font-semibold uppercase text-muted-foreground/85">Material</span>
                        <strong className="text-foreground truncate block">{p.material.split('/')[0]}</strong>
                      </div>
                    </div>

                    <div className="flex justify-between items-baseline pt-1">
                      <div>
                        <span className="text-[9px] text-muted-foreground block">Selling Price</span>
                        <span className="text-sm font-bold text-foreground">â‚¹{p.sellingPrice.toLocaleString()}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-muted-foreground block">Stock Value</span>
                        <span className="text-xs font-semibold text-green-600">₹{(p.sellingPrice * p.quantity).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="flex items-center gap-1.5 border-t border-border pt-3 mt-4 shrink-0">
                    <button
                      onClick={() => { setEditingProduct(p); setFormOpen(true); }}
                      className="flex-1 flex items-center justify-center space-x-1 py-1.5 bg-muted hover:bg-saffron/10 hover:text-saffron rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                    >
                      <Edit3 className="h-3 w-3" />
                      <span>Edit</span>
                    </button>
                    
                    <button
                      onClick={() => handleDuplicate(p)}
                      className="p-1.5 bg-muted hover:bg-gold/15 hover:text-gold rounded-lg transition-all cursor-pointer"
                      title="Duplicate Product"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>

                    <button
                      onClick={() => handlePrintBarcode(p)}
                      className="p-1.5 bg-muted hover:bg-indigo-500/10 hover:text-indigo-500 rounded-lg transition-all cursor-pointer"
                      title="Print Barcode"
                    >
                      <Printer className="h-3.5 w-3.5" />
                    </button>

                    {/* Admin delete actions */}
                    {currentUser?.role === 'admin' && (
                      <>
                        {p.status === 'archived' ? (
                          <button
                            onClick={() => restoreProduct(p.id)}
                            className="p-1.5 bg-muted hover:bg-emerald-500/15 hover:text-emerald-500 rounded-lg transition-all cursor-pointer"
                            title="Restore Product"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => archiveProduct(p.id)}
                            className="p-1.5 bg-muted hover:bg-amber-500/15 hover:text-amber-500 rounded-lg transition-all cursor-pointer"
                            title="Archive Product"
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to delete ${p.name}?`)) {
                              deleteProductSoft(p.id);
                              toast.success('Product soft deleted.');
                            }
                          }}
                          className="p-1.5 bg-muted hover:bg-red-500/15 hover:text-red-500 rounded-lg transition-all cursor-pointer"
                          title="Soft Delete Product"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- ADD/EDIT MODAL OVERLAY --- */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setFormOpen(false)} />
          
          <div className="bg-card border border-border w-full max-w-2xl rounded-2xl shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/20">
              <h3 className="font-bold text-sm text-foreground">{editingProduct ? 'Edit Catalog Product' : 'Add New Ganpati Idol'}</h3>
              <button onClick={() => setFormOpen(false)} className="p-1 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Product ID *</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingProduct}
                    placeholder="GP-1234"
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-saffron/30 disabled:bg-muted/50 disabled:text-muted-foreground"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Product Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Premium Dagdusheth Gold Shringar"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-saffron/30"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-saffron/30 cursor-pointer"
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Material</label>
                  <select
                    value={material}
                    onChange={(e) => setMaterial(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-saffron/30 cursor-pointer"
                  >
                    {materials.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Size Details</label>
                  <input
                    type="text"
                    placeholder="e.g. 2 feet, 18 inches"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-saffron/30"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Weight Details</label>
                  <input
                    type="text"
                    placeholder="e.g. 10 kg, 4.5 kg"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-saffron/30"
                  />
                </div>


                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Selling Price (â‚¹) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    placeholder="2500"
                    value={sellingPrice || ''}
                    onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-saffron/30"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Initial Quantity *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    placeholder="10"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-saffron/30"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Low Stock Limit *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    placeholder="3"
                    value={lowStockLimit}
                    onChange={(e) => setLowStockLimit(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-saffron/30"
                  />
                  <p className="text-[9px] text-muted-foreground">Alert when available stock is this number or lower.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Barcode (defaults to ID)</label>
                  <input
                    type="text"
                    placeholder="GP-1234"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-saffron/30"
                  />
                </div>
              </div>

              {/* Photo Upload section */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Product Photo</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center p-3 bg-muted/20 border border-border rounded-xl">
                  {/* Local file picker */}
                  <div className="space-y-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={uploadingImage}
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center justify-center space-x-1.5 w-full py-2 border border-dashed border-border hover:bg-muted/50 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                    >
                      <UploadCloud className="h-4.5 w-4.5 text-saffron" />
                      <span>{uploadingImage ? 'Processing...' : 'Choose Image File'}</span>
                    </button>
                    {uploadingImage && (
                      <div className="w-full bg-border h-1 rounded-full overflow-hidden">
                        <div className="bg-saffron h-1 animate-pulse w-1/2" />
                      </div>
                    )}
                  </div>
                  {/* Photo URL text field */}
                  <div className="space-y-1">
                    <span className="block text-[8px] text-muted-foreground font-semibold text-center uppercase">OR PASTE DIRECT URL</span>
                    <input
                      type="text"
                      placeholder="https://example.com/ganesha.jpg"
                      value={photoUrl}
                      onChange={(e) => setPhotoUrl(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-[11px] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Description</label>
                <textarea
                  rows={2}
                  placeholder="Detail decoration features, coloring style, posture details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-saffron/30"
                />
              </div>

              {/* Form submit footer */}
              <div className="pt-4 border-t border-border flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-2 border border-border hover:bg-muted rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-saffron to-gold hover:brightness-105 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
                >
                  {editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- BARCODE PRINT VIEW (HIDDEN IN MAIN CSS, SHOWN ON PRINT) --- */}
      {barcodePrintProduct && (
        <div className="hidden print:block fixed inset-0 bg-white z-[9999] p-10 text-black">
          <div className="max-w-xs mx-auto text-center space-y-3.5">
            <h3 className="font-bold text-sm">{barcodePrintProduct.name}</h3>
            <p className="text-[10px] text-slate-700">Size: {barcodePrintProduct.size} | Category: {barcodePrintProduct.category}</p>
            <div className="flex justify-center border p-4 bg-white">
              <Barcode value={barcodePrintProduct.barcode} />
            </div>
            <p className="font-bold text-xs mt-2">Price: â‚¹{barcodePrintProduct.sellingPrice.toLocaleString()}</p>
            <p className="text-[8px] text-slate-500">Onkareshwararts (Internal barcode)</p>
          </div>
        </div>
      )}
    </div>
  );
};
