import jsonwebtoken from "jsonwebtoken";

class JWT {
  /**
   * Crea un token.  
   * - Si recibe un string, lo asume como email y firma { email }.  
   * - Si recibe un objeto, firma el objeto completo.  
   * @param {string | object} data  email o payload completo
   * @param {string} expiresIn      tiempo de vida (p. ej. "7d")
   */
  createToken(data, expiresIn = "7d") {
    let payload;
    
    if (typeof data === "string") {
      // Si es string, asumir que es email
      payload = { email: data };
    } else {
      // Si es objeto, copiar todas las propiedades
      payload = { ...data };
      
      // Asegurar que el payload tenga el ID del usuario de manera consistente
      if (data.id) {
        payload.userId = data.id; // Para compatibilidad con middleware
        payload.id = data.id;     // Mantener el id original
      }
      
      // Si no tiene id pero tiene userId, asegurar consistencia
      if (data.userId && !data.id) {
        payload.id = data.userId;
      }
    }
    
    return jsonwebtoken.sign(payload, process.env.JWT_SECRET, { expiresIn });
  }

  isTokenValid(token) {
    try {
      jsonwebtoken.verify(token, process.env.JWT_SECRET);
      return true;
    } catch {
      return false;
    }
  }

  // Método adicional para verificar y decodificar
  verifyToken(token) {
    try {
      return jsonwebtoken.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      console.error('Error verificando token:', error);
      throw new Error("Token inválido");
    }
  }

  // Método para decodificar sin verificar (útil para debugging)
  decodeToken(token) {
    try {
      return jsonwebtoken.decode(token);
    } catch (error) {
      console.error('Error decodificando token:', error);
      return null;
    }
  }
}

export const jwt = new JWT();

// Exportar como default para compatibilidad
export default new JWT();