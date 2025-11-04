"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { resolveAddressOrENS } from "@/lib/blockchain/wallet";
import { Loader2, Sparkles, Cpu, BarChart3, Moon, Sun } from "lucide-react";
import { IconBolt, IconChartDots3, IconWallet } from "@tabler/icons-react";
import { TronGrid } from "@/components/3d/tron-grid";
import { useTheme } from "next-themes";

export default function Home() {
  const [address, setAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleAnalyze = async () => {
    if (!address.trim()) {
      toast.error("Please enter a wallet address or ENS name");
      return;
    }

    setIsLoading(true);

    try {
      const resolvedAddress = await resolveAddressOrENS(address.trim());

      if (!resolvedAddress) {
        toast.error("Invalid wallet address or ENS name");
        setIsLoading(false);
        return;
      }

      router.push(`/portfolio/${resolvedAddress}`);
    } catch (error) {
      console.error("Error resolving address:", error);
      toast.error("Failed to resolve address. Please try again.");
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAnalyze();
    }
  };

  return (
    <>
      {/* 3D Grid Background */}
      <TronGrid />

      {/* Scanline Effect */}
      <div className="scanline" />

      <div className="min-h-screen relative overflow-hidden">
        {/* Gradient Overlay */}
        <div className="fixed inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />

        {/* Header */}
        <motion.header
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="relative border-b border-primary/30 bg-background/80 backdrop-blur-xl"
        >
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <motion.div
              className="flex items-center gap-3"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <div className="relative">
                <Cpu className="h-8 w-8 text-primary neon-glow" />
                <motion.div
                  className="absolute inset-0"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                >
                  <Sparkles className="h-8 w-8 text-accent opacity-50" />
                </motion.div>
              </div>
              <h1 className="text-2xl font-bold tracking-widest neon-glow glitch">
                FOX<span className="text-primary">REPORT</span>
              </h1>
            </motion.div>

            <div className="flex items-center gap-3">
              {mounted && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="neon-border"
                >
                  {theme === "dark" ? (
                    <Sun className="h-5 w-5" />
                  ) : (
                    <Moon className="h-5 w-5" />
                  )}
                </Button>
              )}
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="neon-border text-xs tracking-wider">
                  ETH
                </Badge>
                <Badge variant="outline" className="neon-border-blue text-xs tracking-wider">
                  ARB
                </Badge>
                <Badge variant="outline" className="neon-border-purple text-xs tracking-wider">
                  BASE
                </Badge>
              </div>
            </div>
          </div>
        </motion.header>

        {/* Hero Section */}
        <main className="container mx-auto px-4 py-20 md:py-32 relative">
          <div className="max-w-4xl mx-auto">
            {/* Title */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-center space-y-6 mb-12"
            >
              <motion.div
                animate={{
                  textShadow: [
                    "0 0 20px rgba(0,255,255,0.5)",
                    "0 0 60px rgba(0,255,255,0.8)",
                    "0 0 20px rgba(0,255,255,0.5)",
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <h2 className="text-5xl md:text-7xl font-bold tracking-wider mb-4">
                  <span className="text-primary">CRYPTO</span> PORTFOLIO
                </h2>
                <h2 className="text-5xl md:text-7xl font-bold tracking-wider">
                  <span className="text-accent">ANALYSIS</span> SYSTEM
                </h2>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-xl md:text-2xl text-muted-foreground tracking-wide font-light"
              >
                ADVANCED MULTI-CHAIN PORTFOLIO TRACKING
              </motion.p>
            </motion.div>

            {/* Search Interface */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              <Card className="neon-border backdrop-blur-xl bg-card/50 border-2 p-8">
                <div className="space-y-6">
                  <div className="text-center">
                    <h3 className="text-2xl font-bold tracking-widest mb-2">INITIALIZE SCAN</h3>
                    <p className="text-muted-foreground text-sm tracking-wide">
                      ENTER TARGET WALLET COORDINATES
                    </p>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 blur-xl" />
                    <div className="relative flex gap-3">
                      <Input
                        placeholder="0x... or vitalik.eth"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        onKeyPress={handleKeyPress}
                        className="text-lg h-14 neon-border bg-background/50 backdrop-blur-sm font-mono tracking-wider"
                        disabled={isLoading}
                      />
                      <Button
                        onClick={handleAnalyze}
                        disabled={isLoading}
                        size="lg"
                        className="h-14 px-8 neon-border bg-primary/20 hover:bg-primary/30 font-bold tracking-widest"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            SCANNING
                          </>
                        ) : (
                          <>
                            <IconBolt className="mr-2 h-5 w-5" />
                            ANALYZE
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="text-center">
                    <p className="text-xs text-muted-foreground tracking-wider">
                      SECURE • LOCAL CACHE • ZERO DATABASE
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Feature Cards */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="grid md:grid-cols-3 gap-6 mt-16"
            >
              {[
                {
                  icon: IconWallet,
                  title: "MULTI-CHAIN",
                  desc: "UNIFIED CROSS-CHAIN ANALYSIS",
                  gradient: "from-primary/20 to-primary/5",
                },
                {
                  icon: IconChartDots3,
                  title: "DEFI TRACKING",
                  desc: "REAL-TIME PROTOCOL POSITIONS",
                  gradient: "from-accent/20 to-accent/5",
                },
                {
                  icon: BarChart3,
                  title: "P&L METRICS",
                  desc: "ADVANCED PROFIT ANALYTICS",
                  gradient: "from-primary/20 to-accent/5",
                },
              ].map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.2 + index * 0.1 }}
                  whileHover={{ scale: 1.05, y: -10 }}
                >
                  <Card className="neon-border backdrop-blur-xl bg-card/30 border p-6 h-full">
                    <div className={`bg-gradient-to-br ${feature.gradient} rounded-lg p-4 w-fit mb-4`}>
                      <feature.icon className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-bold tracking-widest mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground tracking-wide">{feature.desc}</p>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </main>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="relative border-t border-primary/30 mt-20 bg-background/80 backdrop-blur-xl"
        >
          <div className="container mx-auto px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground tracking-wider">
              POWERED BY ALCHEMY • RAINBOWKIT • NEXT.JS
            </p>
          </div>
        </motion.footer>
      </div>
    </>
  );
}
