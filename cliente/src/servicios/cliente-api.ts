export class ErrorApi extends Error {
  constructor(
    public readonly codigoEstado: number,
    public readonly estadoOperacion: string,
    mensaje: string,
    public readonly detalles?: any
  ) {
    super(mensaje);
    this.name = 'ErrorApi';
  }
}

export async function realizarPeticion<T>(
  ruta: string,
  opciones: RequestInit = {}
): Promise<T> {
  const url = ruta.startsWith('/api') ? ruta : `/api/v1${ruta}`;
  
  const cabeceras: Record<string, string> = {
    'Accept': 'application/json',
    ...(opciones.headers as Record<string, string> || {})
  };

  if (!(opciones.body instanceof FormData) && !cabeceras['Content-Type']) {
    cabeceras['Content-Type'] = 'application/json';
  }

  const respuesta = await fetch(url, {
    ...opciones,
    headers: cabeceras,
    credentials: 'include'
  });

  // Manejo de respuestas de descarga binaria (PDF, PNG, Excel)
  const tipoContenido = respuesta.headers.get('content-type') || '';
  if (
    tipoContenido.includes('application/pdf') ||
    tipoContenido.includes('image/png') ||
    tipoContenido.includes('spreadsheetml') ||
    tipoContenido.includes('octet-stream')
  ) {
    if (!respuesta.ok) {
      throw new ErrorApi(respuesta.status, 'ERROR_DESCARGA', 'Error al descargar archivo');
    }
    const blob = await respuesta.blob();
    return blob as unknown as T;
  }

  let datosRespuesta: any = null;
  try {
    datosRespuesta = await respuesta.json();
  } catch {
    datosRespuesta = null;
  }

  if (!respuesta.ok) {
    const estado = datosRespuesta?.estadoOperacion || datosRespuesta?.error || 'ERROR_PETICION';
    const detallesTexto = Array.isArray(datosRespuesta?.detalles)
      ? datosRespuesta.detalles.map((d: any) => d.mensaje || d.message || JSON.stringify(d)).join('; ')
      : (typeof datosRespuesta?.detalles === 'object' && datosRespuesta?.detalles !== null
          ? JSON.stringify(datosRespuesta.detalles)
          : null);

    const mensaje = 
      datosRespuesta?.mensaje || 
      (typeof datosRespuesta?.error === 'string' ? datosRespuesta.error : null) || 
      detallesTexto || 
      `Error en servidor con codigo HTTP ${respuesta.status}`;
    const detalles = datosRespuesta?.detalles || null;
    throw new ErrorApi(respuesta.status, estado, mensaje, detalles);
  }

  return datosRespuesta as T;
}
