import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";

export default function HomePage() {
  const { user, logoutMutation } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            USHA MART
          </h1>
          <div className="flex items-center gap-4">
            {user?.isAdmin && (
              <Link href="/admin">
                <Button variant="outline">Admin Dashboard</Button>
              </Link>
            )}
            <Button
              variant="ghost"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Welcome, {user?.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                View your cashback offers below
              </p>
            </CardContent>
          </Card>

          <Card className="col-span-full">
            <CardHeader>
              <CardTitle>Featured Offers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <img
                  src="https://images.unsplash.com/photo-1534452203293-494d7ddbf7e0"
                  alt="Shopping"
                  className="w-full aspect-video object-cover rounded-lg"
                />
                <img
                  src="https://images.unsplash.com/photo-1558770147-68c0607adb26"
                  alt="Offer"
                  className="w-full aspect-video object-cover rounded-lg"
                />
                <img
                  src="https://images.unsplash.com/photo-1487744480471-9ca1bca6fb7d"
                  alt="Store"
                  className="w-full aspect-video object-cover rounded-lg"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
