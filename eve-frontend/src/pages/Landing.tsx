import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Database, Cpu } from "lucide-react";

const Landing = () => (
  <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
    {/* Background glow */}
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="text-center relative z-10"
    >
      <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-xs font-medium mb-8">
        <Sparkles className="w-3.5 h-3.5" />
        Powered by NERVE
      </div>

      <h1 className="text-6xl sm:text-7xl lg:text-8xl font-extrabold tracking-tight text-foreground mb-4">
        Eve
      </h1>

      <p className="text-lg sm:text-xl text-muted-foreground mb-3 max-w-md mx-auto">
        Describe your AI. We build it.
      </p>
      <p className="text-sm text-muted-foreground/60 mb-12 max-w-sm mx-auto">
        Fine-tuning, GPU selection, training, evaluation — all automated from a single conversation.
      </p>

      <Link
        to="/chat"
        className="bg-primary text-primary-foreground px-8 py-4 text-sm font-semibold rounded-xl inline-flex items-center gap-2 hover:brightness-110 transition-all animate-pulse-glow"
      >
        Start building
        <ArrowRight className="w-4 h-4" />
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="flex justify-center gap-10 mt-16"
      >
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center mx-auto mb-2">
            <Database className="w-4 h-4 text-primary" />
          </div>
          <p className="text-lg font-bold text-foreground">50</p>
          <p className="text-[10px] text-muted-foreground">examples generated</p>
        </div>
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center mx-auto mb-2">
            <Cpu className="w-4 h-4 text-primary" />
          </div>
          <p className="text-lg font-bold text-foreground">12</p>
          <p className="text-[10px] text-muted-foreground">regions scanned</p>
        </div>
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center mx-auto mb-2">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <p className="text-lg font-bold text-foreground">0</p>
          <p className="text-[10px] text-muted-foreground">lines of code</p>
        </div>
      </motion.div>
    </motion.div>

    <p className="absolute bottom-6 text-[10px] text-muted-foreground/40 tracking-widest uppercase">
      Europe Hack 2026
    </p>
  </div>
);

export default Landing;
