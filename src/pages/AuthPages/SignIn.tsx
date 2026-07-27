import { Navigate } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignInForm from "../../components/auth/SignInForm";
import { useAuth } from "../../context/AuthContext";

export default function SignIn() {
  const { session, loading } = useAuth();

  // Already signed in — don't show the login form, go to the app.
  if (!loading && session) {
    return <Navigate to="/product" replace />;
  }

  return (
    <>
      <PageMeta
        title="Sign In | FusionEdge"
        description="Sign in to the FusionEdge admin dashboard"
      />
      <AuthLayout>
        <SignInForm />
      </AuthLayout>
    </>
  );
}
