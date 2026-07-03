import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../lib/supabaseClient";

interface Producto {
  id: string;
  nombre: string;
  precio: number;
  stock: number;
  disponible: boolean;
  imagen_path: string | null;
}

export function CatalogManager({ tenantId, isAdmin }: { tenantId: string; isAdmin: boolean }) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [stock, setStock] = useState("");

  async function loadProductos() {
    const { data } = await supabase
      .from("productos")
      .select("id, nombre, precio, stock, disponible, imagen_path")
      .order("created_at", { ascending: true });
    setProductos((data as Producto[] | null) ?? []);
  }

  useEffect(() => {
    loadProductos();
  }, []);

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await supabase.from("productos").insert({
      tenant_id: tenantId,
      nombre,
      precio: Number(precio) || 0,
      stock: Number(stock) || 0,
    });
    setNombre("");
    setPrecio("");
    setStock("");
    await loadProductos();
  }

  async function toggleDisponible(producto: Producto) {
    await supabase.from("productos").update({ disponible: !producto.disponible }).eq("id", producto.id);
    await loadProductos();
  }

  async function handleDelete(id: string) {
    await supabase.from("productos").delete().eq("id", id);
    await loadProductos();
  }

  async function handleImageUpload(producto: Producto, file: File) {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${tenantId}/${producto.id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (!error) {
      await supabase.from("productos").update({ imagen_path: path }).eq("id", producto.id);
      await loadProductos();
    }
  }

  return (
    <div data-testid="catalog-manager" className="flex w-full max-w-xl flex-col gap-4">
      <ul className="flex flex-col gap-2" data-testid="catalog-list">
        {productos.map((p) => (
          <li key={p.id} data-testid={`product-row-${p.id}`} className="flex items-center gap-3 border border-slate-700 p-2">
            <span data-testid="product-name" className="flex-1">
              {p.nombre}
            </span>
            <span data-testid="product-price">${p.precio}</span>
            <span data-testid="product-stock">stock: {p.stock}</span>
            <span data-testid="product-imagen">{p.imagen_path ? "imagen ✓" : "sin imagen"}</span>
            {isAdmin ? (
              <>
                <button
                  type="button"
                  data-testid={`toggle-disponible-${p.id}`}
                  onClick={() => toggleDisponible(p)}
                  className="rounded border border-slate-600 px-2 py-1 text-xs"
                >
                  {p.disponible ? "disponible" : "no disponible"}
                </button>
                <label className="text-xs">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    data-testid={`upload-image-${p.id}`}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(p, file);
                    }}
                  />
                  imagen
                </label>
                <button
                  type="button"
                  data-testid={`delete-product-${p.id}`}
                  onClick={() => handleDelete(p.id)}
                  className="rounded border border-red-800 px-2 py-1 text-xs text-red-400"
                >
                  borrar
                </button>
              </>
            ) : (
              <span data-testid={`disponible-label-${p.id}`} className="text-xs">
                {p.disponible ? "disponible" : "no disponible"}
              </span>
            )}
          </li>
        ))}
      </ul>

      {isAdmin && (
        <form onSubmit={handleAdd} data-testid="add-product-form" className="flex gap-2">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="nombre"
            data-testid="new-product-name"
            className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1"
            required
          />
          <input
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            placeholder="precio"
            type="number"
            data-testid="new-product-price"
            className="w-24 rounded border border-slate-700 bg-slate-900 px-2 py-1"
            required
          />
          <input
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            placeholder="stock"
            type="number"
            data-testid="new-product-stock"
            className="w-20 rounded border border-slate-700 bg-slate-900 px-2 py-1"
            required
          />
          <button type="submit" data-testid="add-product-button" className="rounded bg-slate-100 px-3 py-1 text-slate-950">
            Agregar
          </button>
        </form>
      )}
    </div>
  );
}
