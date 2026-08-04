import { BrowserRouter as Router, Routes, Route } from "react-router";
import SignIn from "./pages/AuthPages/SignIn";
import SignUp from "./pages/AuthPages/SignUp";
import NotFound from "./pages/OtherPage/NotFound";
import UserProfiles from "./pages/UserProfiles";
import Videos from "./pages/UiElements/Videos";
import Images from "./pages/UiElements/Images";
import Alerts from "./pages/UiElements/Alerts";
import Badges from "./pages/UiElements/Badges";
import Avatars from "./pages/UiElements/Avatars";
import Buttons from "./pages/UiElements/Buttons";
import LineChart from "./pages/Charts/LineChart";
import BarChart from "./pages/Charts/BarChart";
import Calendar from "./pages/Calendar";
import BasicTables from "./pages/Tables/BasicTables";
import FormElements from "./pages/Forms/FormElements";
import Blank from "./pages/Blank";
import Product from "./pages/Product";
import ProductDetail from "./pages/ProductDetail";
import ProductEdit from "./pages/ProductEdit";
import ProductNew from "./pages/ProductNew";
import Media from "./pages/Media";
import Attributes from "./pages/Attributes";
import Categories from "./pages/Categories";
import Brands from "./pages/Brands";
import Companies from "./pages/Companies";
import Users from "./pages/Users";
import RequireAdmin from "./components/auth/RequireAdmin";
import RequireAuth from "./components/auth/RequireAuth";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import Home from "./pages/Dashboard/Home";

export default function App() {
  return (
    <>
      <Router>
        <ScrollToTop />
        <Routes>
          {/* Dashboard Layout — requires a signed-in user */}
          <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route index path="/" element={<Home />} />

            {/* Product */}
            <Route path="/product" element={<Product />} />

            {/* Admin-only product create + editing (static /new before :slug) */}
            <Route element={<RequireAdmin />}>
              <Route path="/product/new" element={<ProductNew />} />
              <Route path="/product/attributes" element={<Attributes />} />
              <Route path="/product/categories" element={<Categories />} />
              <Route path="/product/brands" element={<Brands />} />
              <Route path="/product/companies" element={<Companies />} />
              <Route path="/product/:slug/edit" element={<ProductEdit />} />
              <Route path="/media" element={<Media />} />
              <Route path="/users" element={<Users />} />
            </Route>

            <Route path="/product/:slug" element={<ProductDetail />} />

            {/* Others Page */}
            <Route path="/profile" element={<UserProfiles />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/blank" element={<Blank />} />

            {/* Forms */}
            <Route path="/form-elements" element={<FormElements />} />

            {/* Tables */}
            <Route path="/basic-tables" element={<BasicTables />} />

            {/* Ui Elements */}
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/avatars" element={<Avatars />} />
            <Route path="/badge" element={<Badges />} />
            <Route path="/buttons" element={<Buttons />} />
            <Route path="/images" element={<Images />} />
            <Route path="/videos" element={<Videos />} />

            {/* Charts */}
            <Route path="/line-chart" element={<LineChart />} />
            <Route path="/bar-chart" element={<BarChart />} />
          </Route>
          </Route>

          {/* Auth Layout */}
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />

          {/* Fallback Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </>
  );
}
