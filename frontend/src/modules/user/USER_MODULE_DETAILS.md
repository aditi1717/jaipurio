# User Module - Detailed Feature Overview

This document provides a comprehensive breakdown of all features, pages, and UI elements within the User Module of the Appzeto-Flipkart application.

## 1. Global Navigation & Layout
The application uses a persistent layout for core navigation, with specific overrides for immersive pages.

### **Header (Top Navigation)**
- **Logo Area**:
  - **Logo**: "Jaipurio" logo on the left.
- **Location Strip**: Displayed below the logo row. Shows "Delivering to [Pincode]" and "Update location".
- **Search Bar**:
  - Full-width search input ("Search for products").
  - Camera/Lens icon for visual search.
- **Desktop Navigation**: (Hidden on mobile) Links for Login, More, Cart.

### **Bottom Navigation (Mobile Footer)**
Sticky bottom bar visible on most pages (hidden on Play, Product Details, etc.).
- **Home**: Redirects to Homepage.
- **Play**: Redirects to Video Reels (`/play`).
- **Categories**: **NEW**. Redirects to All Categories page (`/categories`).
- **Account**: Redirects to User Profile (`/account`).
- **Cart**: Redirects to Shopping Cart (`/cart`) with a dynamic badge showing total items.

---

## 2. Pages & Features

### **A. Homepage (`/`)**
The landing page for the user.
- **Category Strip**: Horizontal scroll of circular category icons (Mobiles, Fashion, Grocery, etc.).
- **Hero Banner**: Auto-scrolling image slider highlighting top sales/events.
- **Product Sections**:
  - **"Sponsored"**: Single featured product card.
  - **"Discounts for You"**: Horizontal scrollable list of products with heavy discounts.
  - **"Best of Electronics"**: Grid or scroll view of electronic items.

### **B. All Categories (`/categories`)**
A dedicated page for browsing all available categories.
- **Layout**: Split-screen design (similar to Flipkart/Amazon).
- **Left Sidebar**: Vertical list of main categories (Fashion, Electronics, Home, etc.) with icons. Selecting a category highlights it with a blue strip.
- **Right Content Area**:
  - **Dynamic Content**: Shows subcategories for the selected main category.
  - **Grid View**: Subcategories displayed as a grid of circular images + names (e.g., "T-Shirts", "Jeans", "Pro Series").
  - **Clean UI**: No extra banners or ads, strictly navigation focused.

### **C. Play (`/play`)**
An Instagram Reels-style immersive video shopping experience.
- **Video Player**:
  - Full-screen vertical video playback.
  - **Auto-play**: Videos play automatically when they come into view.
  - **Snap Scrolling**: "Swipe" interaction that snaps to the next/previous video.
- **Interactions**:
  - **Mute Toggle**: Top-right button to mute/unmute.
  - **Back Button**: Top-left button to return to Home.
  - **Right Sidebar**:
    - **Like**: Heart icon (toggle state).
    - **Share**: Share icon.
- **Product CTA (Bottom)**:
  - "View Product" floating card at the bottom.
  - Shows "Tap to see details".
  - **Action**: Clicking redirects to the specific Product Detail Page (`/product/:id`).

### **D. Product Detail Page (`/product/:id`)**
 Detailed view for a single product.
- **Image Gallery**: Large product image with carousel indicators.
- **Product Info**:
  - Title, Brand Name.
  - Pricing: Current Price, Original Price (strikethrough), Discount percentage.
  - Rating badge.
- **Offers**: Bank offers, EMI options listed.
- **Delivery**: Pincode checker and estimated delivery date.
- **Sticky Footer Actions**:
  - **Add to Cart**: Adds item to global cart state.
  - **Buy Now**: Direct purchase flow.
- **Similar Products**: Horizontal list of related items.

### **E. Account Page (`/account`)**
User profile and settings management.
- **Profile Header**: User Name, Phone Number, and "Edit" button.
- **Finance Options**: **NEW**.
  - Section highlighting "Upto 15% discount on every PhonePe transaction".
- **Quick Links (Grid)**:
  - Orders, Wishlist, Coupons, Help Center.
- **Settings List**:
  - Saved Addresses.
  - Select Language.
  - Notification Settings.
- **Logout**: Button to clear session and return to Home.

### **F. Cart (`/cart`)**
Shopping cart management.
- **Item List**: Each item shows image, title, price, and quantity controls (+/-).
- **Price Details**: Breakdown of Item Total, Discount, Delivery Charges, and Total Amount.
- **Place Order**: fixed bottom button to proceed to Checkout.
- **Empty State**: Shows "Your cart is empty" if no items are added.

---

## 3. Navigation Flows
- **Category -> Subcategory**: Clicking a subcategory in `/categories` navigates to filtered Product Listing.
- **Play -> Product**: Clicking the bottom card in a video reel takes you to that specific product's page.
- **Back Navigation**:
  - `/play` has a custom back button to Home.
