import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const withAuth = (WrappedComponent) => {
    const AuthenticatedComponent = (props) => {
        const navigate = useNavigate();

        useEffect(() => {
            const token = localStorage.getItem("token");
            if (!token) {
                navigate("/auth");
            }
        }, [navigate]);

        const token = localStorage.getItem("token");
        if (!token) return null;

        return <WrappedComponent {...props} />;
    };

    AuthenticatedComponent.displayName = `withAuth(${WrappedComponent.displayName || WrappedComponent.name})`;
    return AuthenticatedComponent;
};

export default withAuth;
