import { PuertoRepositorioPropuestas } from '../../dominio/puertos/puerto-repositorio-propuestas.js';
import { ResumenPropuestaProveedor } from '../../dominio/entidades/decision-compra.js';

export class CasoUsoConsultarPropuestaProveedor {
  constructor(private readonly repositorioPropuestas: PuertoRepositorioPropuestas) {}

  async ejecutar(identificadorProveedor: string): Promise<ResumenPropuestaProveedor | null> {
    return await this.repositorioPropuestas.obtenerPropuestaPorProveedor(identificadorProveedor);
  }
}
