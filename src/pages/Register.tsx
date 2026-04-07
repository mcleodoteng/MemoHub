import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, ShieldAlert } from "lucide-react";

const Register = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary mx-auto">
            <FileText className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            MemoHub
          </h1>
          <p className="text-sm text-muted-foreground">
            Enterprise Memo Management Platform
          </p>
        </div>

        <Card className="border-border/50 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg font-display">
              <ShieldAlert className="h-5 w-5 text-warning" />
              Account Creation Restricted
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Self-registration is{" "}
              <span className="font-semibold text-foreground">disabled</span> on
              this platform. Accounts are created by the system administrator.
            </p>
            <p>
              If you need access, please contact your system administrator and
              they will create an account and provide your login credentials.
            </p>
            <Button asChild className="w-full mt-2">
              <Link to="/login">Back to Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Register;
