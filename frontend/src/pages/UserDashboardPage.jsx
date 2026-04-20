import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import OfferBanners from "../components/OfferBanners";
import OrderStatusTimeline from "../components/OrderStatusTimeline";
import RestaurantCard from "../components/RestaurantCard";
import { addToCart } from "../redux/slices/cartSlice";
import { fetchOrders, fetchOrderById, setActiveOrderFromSocket } from "../redux/slices/orderSlice";
import { fetchRestaurants, fetchRestaurantById } from "../redux/slices/restaurantSlice";
import { fetchAiRecommendations, fetchQuickReorder } from "../redux/slices/aiSlice";
import { addToast } from "../redux/slices/uiSlice";
import { connectSocket } from "../services/socket";
import api from "../services/api";
import { formatCurrency, formatDateTime } from "../utils/format";

const ADDRESS_KEY = "foodex_addresses";

const parseStored = (key, fallback = []) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (_error) {
    return fallback;
  }
};

const UserDashboardPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { user, token } = useSelector((state) => state.auth);
  const { restaurants, selectedRestaurant } = useSelector((state) => state.restaurants);
  const { orders, activeOrder, loading: ordersLoading } = useSelector((state) => state.orders);
  const { recommendations } = useSelector((state) => state.ai);
  const { items: cartItems } = useSelector((state) => state.cart);
  const favoriteIds = useSelector((state) => state.wishlist.restaurantIds);

  const [query, setQuery] = useState("");
  const [location, setLocation] = useState(user?.address?.city || "All Locations");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [priceFilter, setPriceFilter] = useState("all");
  const [cuisineFilter, setCuisineFilter] = useState("all");
  const [distanceFilter, setDistanceFilter] = useState("all");
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");
  const [selectedCoupon, setSelectedCoupon] = useState("");

  const [addresses, setAddresses] = useState(() => parseStored(ADDRESS_KEY, []));
  const [addressForm, setAddressForm] = useState({ line1: "", city: "", state: "", postalCode: "" });
  const [editingAddressId, setEditingAddressId] = useState("");

  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewForm, setReviewForm] = useState({ orderId: "", rating: 5, comment: "" });

  const openRestaurants = useMemo(
    () => restaurants.filter((restaurant) => restaurant.isOpen !== false),
    [restaurants]
  );

  const cityOptions = useMemo(() => {
    const set = new Set(["All Locations"]);
    if (user?.address?.city) {
      set.add(user.address.city);
    }
    openRestaurants.forEach((restaurant) => {
      if (restaurant.address?.city) {
        set.add(restaurant.address.city);
      }
    });
    return Array.from(set);
  }, [openRestaurants, user?.address?.city]);

  const cuisineOptions = useMemo(() => {
    const set = new Set(["all"]);
    openRestaurants.forEach((restaurant) => {
      (restaurant.cuisine || []).forEach((cuisine) => set.add(cuisine));
    });
    return Array.from(set);
  }, [openRestaurants]);

  const activeOffers = useMemo(() => {
    const favoriteCount = favoriteIds.length;
    const fastRestaurants = openRestaurants.filter((restaurant) => {
      const eta = Number(String(restaurant.deliveryTime || "30").split("-")[0]);
      return !Number.isNaN(eta) && eta <= 25;
    }).length;

    return [
      {
        title: `Welcome ${user?.name?.split(" ")[0] || "Foodie"}!`,
        code: favoriteCount ? "FAV10" : "WELCOME10",
        sub: favoriteCount
          ? `${favoriteCount} favorites saved. Unlock member rewards.`
          : "Add your first favorite and unlock instant deals.",
      },
      {
        title: "Fast lane kitchens",
        code: "QUICK20",
        sub: `${fastRestaurants} restaurants can deliver in ~25 mins or less.`,
      },
      {
        title: "AI Smart Basket",
        code: recommendations?.mayLike?.length ? "AIPICK15" : "SAVE5",
        sub: recommendations?.mayLike?.length
          ? `You have ${recommendations.mayLike.length} personalized picks ready.`
          : "Start browsing to unlock personalized item picks.",
      },
    ];
  }, [favoriteIds.length, openRestaurants, recommendations?.mayLike?.length, user?.name]);

  const filteredRestaurants = useMemo(() => {
    const value = query.trim().toLowerCase();

    return openRestaurants.filter((restaurant) => {
      const matchQuery =
        !value ||
        restaurant.name?.toLowerCase().includes(value) ||
        restaurant.address?.city?.toLowerCase().includes(value) ||
        (restaurant.cuisine || []).join(" ").toLowerCase().includes(value);

      const matchLocation =
        location === "All Locations" || (restaurant.address?.city || "").toLowerCase() === location.toLowerCase();

      const rating = Number(restaurant.rating || 4);
      const matchRating = ratingFilter === "all" || rating >= Number(ratingFilter);

      const matchCuisine = cuisineFilter === "all" || (restaurant.cuisine || []).includes(cuisineFilter);

      const avgPrice = Number(restaurant.avgPrice || restaurant.priceForTwo || 400);
      const matchPrice =
        priceFilter === "all" ||
        (priceFilter === "budget" && avgPrice <= 300) ||
        (priceFilter === "mid" && avgPrice > 300 && avgPrice <= 700) ||
        (priceFilter === "premium" && avgPrice > 700);

      const eta = Number(restaurant.estimatedWaitMinutes || String(restaurant.deliveryTime || "30").split("-")[0]);
      const matchDistance =
        distanceFilter === "all" ||
        (distanceFilter === "near" && eta <= 20) ||
        (distanceFilter === "medium" && eta > 20 && eta <= 35) ||
        (distanceFilter === "far" && eta > 35);

      return matchQuery && matchLocation && matchRating && matchCuisine && matchPrice && matchDistance;
    });
  }, [openRestaurants, query, location, ratingFilter, cuisineFilter, priceFilter, distanceFilter]);

  const favoriteRestaurants = useMemo(
    () => openRestaurants.filter((restaurant) => favoriteIds.includes(restaurant._id)),
    [openRestaurants, favoriteIds]
  );

  const deliveredOrders = useMemo(
    () => (orders || []).filter((order) => order.status === "delivered"),
    [orders]
  );

  const reviewedOrderIds = useMemo(() => {
    return new Set(
      (reviews || []).map((review) => {
        if (typeof review.order === "string") {
          return review.order;
        }

        return review.order?._id;
      })
    );
  }, [reviews]);

  const availableReviewOrders = useMemo(() => {
    return deliveredOrders.filter((order) => !reviewedOrderIds.has(order._id));
  }, [deliveredOrders, reviewedOrderIds]);

  const latestOrder = activeOrder || orders[0] || null;

  const couponOptions = useMemo(
    () => [
      { code: "FOODEX30", label: "30% off above Rs.499", discountRate: 0.3 },
      { code: "FASTFREE", label: "8% flat + delivery focus", discountRate: 0.08 },
      { code: "AIPICK15", label: "15% off AI recommendations", discountRate: 0.15 },
    ],
    []
  );

  const cartSubtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cartItems]
  );

  const selectedCouponMeta = couponOptions.find((coupon) => coupon.code === selectedCoupon);
  const couponDiscount = cartSubtotal * (selectedCouponMeta?.discountRate || 0);

  useEffect(() => {
    dispatch(fetchRestaurants());
    if (token) {
      dispatch(fetchOrders());
      dispatch(fetchAiRecommendations());
      dispatch(fetchQuickReorder());
    }
  }, [dispatch, token]);

  useEffect(() => {
    if (!selectedRestaurantId) {
      return;
    }
    dispatch(fetchRestaurantById(selectedRestaurantId));
  }, [dispatch, selectedRestaurantId]);

  useEffect(() => {
    localStorage.setItem(ADDRESS_KEY, JSON.stringify(addresses));
  }, [addresses]);

  useEffect(() => {
    const loadReviews = async () => {
      if (!token) {
        return;
      }

      setReviewsLoading(true);
      try {
        const response = await api.get("/reviews/me");
        setReviews(response.data?.data || []);
      } catch (error) {
        dispatch(addToast({ type: "error", message: error.message || "Failed to load reviews" }));
      } finally {
        setReviewsLoading(false);
      }
    };

    loadReviews();
  }, [token, dispatch]);

  useEffect(() => {
    if (!token || !latestOrder?._id) {
      return undefined;
    }

    const socket = connectSocket(token);
    if (!socket) {
      return undefined;
    }

    const roomOrderId = latestOrder._id;
    socket.emit("order:join", { orderId: roomOrderId });

    const onOrderUpdate = (payload) => {
      if (payload?.order?._id === roomOrderId) {
        dispatch(setActiveOrderFromSocket(payload.order));
        dispatch(
          addToast({
            type: "info",
            message: `Order ${payload.order.shortId || payload.order._id.slice(-6)} is now ${payload.order.status}`,
          })
        );
      }
    };

    socket.on("order:update", onOrderUpdate);

    return () => {
      socket.emit("order:leave", { orderId: roomOrderId });
      socket.off("order:update", onOrderUpdate);
    };
  }, [token, latestOrder?._id, dispatch]);

  useEffect(() => {
    const timer = setInterval(() => {
      dispatch(addToast({ message: "Hot offer: Use FOODEX30 during checkout for instant savings" }));
    }, 45000);

    return () => clearInterval(timer);
  }, [dispatch]);

  const saveAddress = (event) => {
    event.preventDefault();

    if (editingAddressId) {
      setAddresses((prev) => prev.map((address) => (address.id === editingAddressId ? { ...address, ...addressForm } : address)));
      dispatch(addToast({ type: "success", message: "Address updated" }));
    } else {
      const nextAddress = { id: String(Date.now()), ...addressForm };
      setAddresses((prev) => [nextAddress, ...prev]);
      dispatch(addToast({ type: "success", message: "Address added" }));
    }

    setAddressForm({ line1: "", city: "", state: "", postalCode: "" });
    setEditingAddressId("");
  };

  const editAddress = (address) => {
    setEditingAddressId(address.id);
    setAddressForm({
      line1: address.line1,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
    });
  };

  const deleteAddress = (id) => {
    setAddresses((prev) => prev.filter((address) => address.id !== id));
    dispatch(addToast({ type: "success", message: "Address deleted" }));
  };

  const handleReviewSubmit = async (event) => {
    event.preventDefault();

    if (!reviewForm.orderId) {
      dispatch(addToast({ type: "error", message: "Select a delivered order to review" }));
      return;
    }

    setReviewSubmitting(true);
    try {
      const response = await api.post("/reviews", {
        orderId: reviewForm.orderId,
        rating: Number(reviewForm.rating),
        comment: reviewForm.comment,
      });

      setReviews((prev) => [response.data.data, ...prev].slice(0, 20));
      setReviewForm({ orderId: "", rating: 5, comment: "" });
      dispatch(addToast({ type: "success", message: "Review submitted" }));
    } catch (error) {
      dispatch(addToast({ type: "error", message: error.message || "Failed to submit review" }));
    } finally {
      setReviewSubmitting(false);
    }
  };

  const reorderOrder = (order) => {
    const restaurantId = order.restaurant?._id || order.restaurant;

    (order.items || []).forEach((item) => {
      dispatch(
        addToCart({
          menuItemId: item.menuItem?._id || item.menuItem || item._id || `${order._id}-${item.name}`,
          restaurantId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })
      );
    });

    dispatch(addToast({ type: "success", message: "Items added to cart for reorder" }));
    navigate("/cart");
  };

  const addRecommendedToCart = (item) => {
    dispatch(
      addToCart({
        menuItemId: item._id,
        restaurantId: item.restaurant?._id || item.restaurant,
        name: item.name,
        price: item.price,
        quantity: 1,
      })
    );
    dispatch(addToast({ type: "success", message: `${item.name} added to cart` }));
  };

  return (
    <div className="space-y-7">
      <section className="sticky top-[72px] z-30 rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
        <div className="grid gap-3 md:grid-cols-[1.2fr,0.8fr,auto]">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search restaurants, cuisines, dishes"
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800 outline-none ring-orange-400 focus:ring dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          <select
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {cityOptions.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
          <div className="flex items-center justify-between rounded-full border border-slate-200 px-4 py-2 text-sm dark:border-slate-700">
            <div>
              <p className="font-semibold text-slate-900 dark:text-slate-100">{user?.name || "Guest"}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{user?.email || ""}</p>
            </div>
            <Link to="/orders/track" className="text-xs font-bold text-rose-600">
              Track
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-orange-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-600">User Dashboard</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900 dark:text-slate-100">
          Good to see you, {user?.name?.split(" ")[0] || "Foodie"}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Discover restaurants, manage addresses, reorder quickly, track in real time, and checkout securely.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link to="/restaurants" className="rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-700">
            Browse restaurants
          </Link>
          <Link to="/checkout" className="rounded-full border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 hover:border-slate-500 dark:border-slate-700 dark:text-slate-100">
            Go to checkout
          </Link>
        </div>
      </section>

      <OfferBanners offers={activeOffers} />

      <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:grid-cols-5">
        <select value={ratingFilter} onChange={(event) => setRatingFilter(event.target.value)} className="rounded-full border border-slate-300 px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
          <option value="all">All ratings</option>
          <option value="4">4.0+</option>
          <option value="4.5">4.5+</option>
        </select>
        <select value={priceFilter} onChange={(event) => setPriceFilter(event.target.value)} className="rounded-full border border-slate-300 px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
          <option value="all">All price ranges</option>
          <option value="budget">Budget</option>
          <option value="mid">Mid range</option>
          <option value="premium">Premium</option>
        </select>
        <select value={cuisineFilter} onChange={(event) => setCuisineFilter(event.target.value)} className="rounded-full border border-slate-300 px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
          {cuisineOptions.map((cuisine) => (
            <option key={cuisine} value={cuisine}>
              {cuisine === "all" ? "All cuisines" : cuisine}
            </option>
          ))}
        </select>
        <select value={distanceFilter} onChange={(event) => setDistanceFilter(event.target.value)} className="rounded-full border border-slate-300 px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
          <option value="all">All distances</option>
          <option value="near">Near (fast)</option>
          <option value="medium">Medium</option>
          <option value="far">Far</option>
        </select>
        <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {filteredRestaurants.length} matches
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">Restaurants for you</h2>
          <Link to="/restaurants" className="text-sm font-semibold text-rose-600">View all</Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredRestaurants.slice(0, 6).map((restaurant) => (
            <RestaurantCard key={restaurant._id} restaurant={restaurant} />
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Favorites & recommendations</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Wishlist restaurants and AI item suggestions.</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {favoriteRestaurants.length ? (
              favoriteRestaurants.slice(0, 6).map((restaurant) => (
                <Link key={restaurant._id} to={`/restaurants/${restaurant._id}`} className="rounded-full border border-orange-200 px-3 py-1 text-xs font-semibold text-orange-700 dark:border-slate-700 dark:text-orange-300">
                  {restaurant.name}
                </Link>
              ))
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-300">No favorites yet. Tap the heart icon on restaurants.</p>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(recommendations?.mayLike || []).slice(0, 4).map((item) => (
              <div key={item._id} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                <p className="font-semibold text-slate-900 dark:text-slate-100">{item.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-300">{item.restaurant?.name || "Kitchen"}</p>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-sm font-bold text-rose-600">{formatCurrency(item.price)}</p>
                  <button
                    type="button"
                    onClick={() => addRecommendedToCart(item)}
                    className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white"
                  >
                    Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Live order tracking</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Realtime status and quick action controls.</p>

          {latestOrder ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800">
                <p className="text-xs uppercase tracking-wide text-slate-500">Latest order</p>
                <p className="mt-1 font-bold text-slate-900 dark:text-slate-100">
                  #{latestOrder.shortId || latestOrder._id?.slice(-8)}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-300">{formatDateTime(latestOrder.createdAt)}</p>
                <p className="mt-1 text-sm font-semibold text-rose-600">{formatCurrency(latestOrder.totalAmount || 0)}</p>
              </div>

              <OrderStatusTimeline status={latestOrder.status} />

              <div className="flex flex-wrap gap-2">
                <Link
                  to={`/orders/track?orderId=${latestOrder._id}`}
                  className="rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white"
                >
                  Open live map
                </Link>
                <button
                  type="button"
                  onClick={() => reorderOrder(latestOrder)}
                  className="rounded-full border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-100"
                >
                  Reorder
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-300">No active orders yet. Place your first order to see live tracking.</p>
          )}
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Address management</h3>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Checkout ready</span>
          </div>

          <form onSubmit={saveAddress} className="mt-4 grid gap-2 sm:grid-cols-2">
            <input required value={addressForm.line1} onChange={(event) => setAddressForm((prev) => ({ ...prev, line1: event.target.value }))} placeholder="Address line" className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
            <input required value={addressForm.city} onChange={(event) => setAddressForm((prev) => ({ ...prev, city: event.target.value }))} placeholder="City" className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
            <input required value={addressForm.state} onChange={(event) => setAddressForm((prev) => ({ ...prev, state: event.target.value }))} placeholder="State" className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
            <input required value={addressForm.postalCode} onChange={(event) => setAddressForm((prev) => ({ ...prev, postalCode: event.target.value }))} placeholder="Postal code" className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
            <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white sm:col-span-2">
              {editingAddressId ? "Update address" : "Add address"}
            </button>
          </form>

          <div className="mt-4 space-y-2">
            {addresses.map((address) => (
              <div key={address.id} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{address.line1}</p>
                <p className="text-xs text-slate-500 dark:text-slate-300">{address.city}, {address.state} {address.postalCode}</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => editAddress(address)} className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Edit</button>
                  <button type="button" onClick={() => deleteAddress(address.id)} className="rounded-full border border-rose-300 px-3 py-1 text-xs font-semibold text-rose-700">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Coupons, payments, and checkout</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Apply discount and continue with Razorpay-secured checkout.</p>

          <div className="mt-4 grid gap-2">
            {couponOptions.map((coupon) => (
              <button
                key={coupon.code}
                type="button"
                onClick={() => setSelectedCoupon(coupon.code)}
                className={
                  "flex items-center justify-between rounded-xl border px-3 py-2 text-sm " +
                  (selectedCoupon === coupon.code
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200")
                }
              >
                <span className="font-semibold">{coupon.code}</span>
                <span className="text-xs">{coupon.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800">
            <p className="text-sm text-slate-600 dark:text-slate-300">Cart subtotal</p>
            <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{formatCurrency(cartSubtotal)}</p>
            <p className="mt-1 text-sm font-semibold text-emerald-600">Coupon savings: -{formatCurrency(couponDiscount)}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Payments are processed via Razorpay integration on checkout.</p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/cart" className="rounded-full border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-100">View cart</Link>
            <Link to="/checkout" className="rounded-full bg-rose-500 px-4 py-2 text-xs font-bold text-white">Checkout now</Link>
          </div>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Menu explorer (categorized)</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Preview menu categories before opening restaurant details.</p>

          <select
            value={selectedRestaurantId}
            onChange={(event) => setSelectedRestaurantId(event.target.value)}
            className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">Select a restaurant</option>
            {openRestaurants.map((restaurant) => (
              <option key={restaurant._id} value={restaurant._id}>
                {restaurant.name}
              </option>
            ))}
          </select>

          {!!selectedRestaurant?.menu?.length && (
            <div className="mt-4 space-y-3">
              {Array.from(new Set(selectedRestaurant.menu.map((item) => item.category || "Chef Picks")))
                .slice(0, 4)
                .map((category) => {
                  const items = selectedRestaurant.menu.filter((item) => (item.category || "Chef Picks") === category).slice(0, 3);
                  return (
                    <div key={category} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                      <p className="text-xs font-black uppercase tracking-wide text-rose-600">{category}</p>
                      <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
                        {items.map((item) => (
                          <li key={item._id} className="flex items-center justify-between">
                            <span>{item.name}</span>
                            <span className="font-semibold">{formatCurrency(item.price)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}

              <Link
                to={`/restaurants/${selectedRestaurant.restaurant?._id || selectedRestaurantId}`}
                className="inline-flex rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white"
              >
                Open full restaurant page
              </Link>
            </div>
          )}
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Ratings & reviews</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Submit feedback for delivered orders and keep your review log synced.</p>

          <form onSubmit={handleReviewSubmit} className="mt-4 grid gap-2">
            <select
              required
              value={reviewForm.orderId}
              onChange={(event) => setReviewForm((prev) => ({ ...prev, orderId: event.target.value }))}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">Choose delivered order</option>
              {availableReviewOrders.map((order) => (
                <option key={order._id} value={order._id}>
                  #{order.shortId || order._id.slice(-8)} - {order.restaurant?.name || "Restaurant"}
                </option>
              ))}
            </select>

            <select
              value={reviewForm.rating}
              onChange={(event) => setReviewForm((prev) => ({ ...prev, rating: Number(event.target.value) }))}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              {[5, 4, 3, 2, 1].map((rating) => (
                <option key={rating} value={rating}>
                  {rating} Stars
                </option>
              ))}
            </select>

            <textarea
              required
              value={reviewForm.comment}
              onChange={(event) => setReviewForm((prev) => ({ ...prev, comment: event.target.value }))}
              rows={3}
              placeholder="Write your review"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />

            <button
              type="submit"
              disabled={reviewSubmitting}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {reviewSubmitting ? "Submitting..." : "Submit review"}
            </button>
          </form>

          <div className="mt-4 space-y-2">
            {reviewsLoading && <p className="text-sm text-slate-500 dark:text-slate-300">Loading reviews...</p>}
            {reviews.slice(0, 5).map((review) => (
              <div key={review._id || review.id} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{review.restaurant?.name || review.restaurantName}</p>
                <p className="text-xs text-amber-600">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{review.comment}</p>
                {review.ownerResponse?.text && (
                  <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                    Owner response: {review.ownerResponse.text}
                  </p>
                )}
              </div>
            ))}
            {!reviewsLoading && !reviews.length && (
              <p className="text-sm text-slate-500 dark:text-slate-300">No reviews yet.</p>
            )}
          </div>
        </article>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Order history</h3>
          {ordersLoading && <span className="text-xs text-slate-500">Refreshing...</span>}
        </div>

        <div className="mt-4 space-y-3">
          {(orders || []).slice(0, 8).map((order) => (
            <article key={order._id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">#{order.shortId || order._id.slice(-8)}</p>
                <p className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {order.status}
                </p>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatDateTime(order.createdAt)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => reorderOrder(order)}
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-100"
                >
                  Reorder
                </button>
                <Link
                  to={`/orders/track?orderId=${order._id}`}
                  className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white"
                >
                  Track
                </Link>
              </div>
            </article>
          ))}
          {!orders?.length && <p className="text-sm text-slate-500 dark:text-slate-300">No order history yet.</p>}
        </div>
      </section>
    </div>
  );
};

export default UserDashboardPage;
