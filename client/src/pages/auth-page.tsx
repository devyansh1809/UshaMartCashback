import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, type InsertUser } from "@shared/schema";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();

  const loginForm = useForm({
    defaultValues: { username: "", password: "" },
  });

  const registerForm = useForm({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: "",
      password: "",
      name: "",
      address: "",
      phone: "",
    },
  });

  if (user) {
    return <Redirect to="/" />;
  }

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 p-8 flex items-center justify-center">
        <Tabs defaultValue="login" className="w-full max-w-md">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <Card>
              <CardHeader>
                <h2 className="text-2xl font-bold">Welcome Back</h2>
                <p className="text-muted-foreground">
                  Login to access your account
                </p>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={loginForm.handleSubmit((data) =>
                    loginMutation.mutate(data)
                  )}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      {...loginForm.register("username")}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      {...loginForm.register("password")}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loginMutation.isPending}
                  >
                    {loginMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Login
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="register">
            <Card>
              <CardHeader>
                <h2 className="text-2xl font-bold">Create Account</h2>
                <p className="text-muted-foreground">
                  Register to start earning cashback
                </p>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={registerForm.handleSubmit((data) =>
                    registerMutation.mutate(data)
                  )}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="reg-username">Username</Label>
                    <Input
                      id="reg-username"
                      {...registerForm.register("username")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-password">Password</Label>
                    <Input
                      id="reg-password"
                      type="password"
                      {...registerForm.register("password")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" {...registerForm.register("name")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Input id="address" {...registerForm.register("address")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone (10 digits)</Label>
                    <Input id="phone" {...registerForm.register("phone")} />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={registerMutation.isPending}
                  >
                    {registerMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Register
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <div className="hidden lg:block relative flex-1 bg-primary/5">
        <div className="absolute inset-0 flex flex-col items-center justify-center p-12">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            USHA MART CASHBACK STORE
          </h1>
          <div className="grid grid-cols-2 gap-4 w-full max-w-2xl">
            <Card className="col-span-2">
              <CardContent className="p-4">
                <img
                  src="https://images.unsplash.com/photo-1483181957632-8bda974cbc91"
                  alt="Store front"
                  className="w-full h-48 object-cover rounded"
                />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <img
                  src="https://images.unsplash.com/photo-1558770147-a0e2842c5ea1"
                  alt="Cashback offer"
                  className="w-full h-32 object-cover rounded"
                />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <img
                  src="https://images.unsplash.com/photo-1527264935190-1401c51b5bbc"
                  alt="Special offer"
                  className="w-full h-32 object-cover rounded"
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
