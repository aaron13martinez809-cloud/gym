"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../lib/supabaseClient";
import { Wordmark, Spinner, Banner } from "../components/ui";

export default function Home() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = supabaseBrowser();
    let cancelado = false;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelado) return;
      if (!session) return router.replace("/login");

      const { data: perfil, error } = await supabase
        .from("perfiles")
        .select("rol")
        .eq("id", session.user.id)
        .maybeSingle();

      if (cancelado) return;

      if (error) {
        setError("No pudimos cargar tu perfil. Probá recargar la página.");
        return;
      }

      router.replace(perfil?.rol === "profesor" ? "/profesor" : "/alumno");
    })();

    return () => {
      cancelado = true;
    };
  }, [router]);

  return (
    <div className="center-screen">
      <div style={{ display: "grid", placeItems: "center", gap: 18, maxWidth: 320 }}>
        <Wordmark size={24} />
        {error ? <Banner>{error}</Banner> : <Spinner grande />}
      </div>
    </div>
  );
}
