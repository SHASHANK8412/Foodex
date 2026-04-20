const express = require("express");
const restaurantController = require("../controllers/restaurantController");
const { protect } = require("../middlewares/authMiddleware");
const { authorize } = require("../middlewares/roleMiddleware");
const validate = require("../middlewares/validateMiddleware");
const ROLES = require("../constants/roles");
const { restaurantValidator, menuItemValidator } = require("../validators/restaurantValidator");

const router = express.Router();

router.get("/", restaurantController.listRestaurants);
router.get("/mine", protect, authorize(ROLES.RESTAURANT), restaurantController.listMyRestaurants);
router.get("/:restaurantId", restaurantController.getRestaurant);

router.post(
  "/",
  protect,
  authorize(ROLES.ADMIN, ROLES.RESTAURANT),
  ...restaurantValidator,
  validate,
  restaurantController.createRestaurant
);
router.patch("/:restaurantId", protect, authorize(ROLES.ADMIN, ROLES.RESTAURANT), restaurantController.updateRestaurant);

router.post(
  "/:restaurantId/menu",
  protect,
  authorize(ROLES.ADMIN, ROLES.RESTAURANT),
  ...menuItemValidator,
  validate,
  restaurantController.createMenuItem
);
router.patch(
  "/menu/:menuItemId",
  protect,
  authorize(ROLES.ADMIN, ROLES.RESTAURANT),
  restaurantController.updateMenuItem
);

module.exports = router;
