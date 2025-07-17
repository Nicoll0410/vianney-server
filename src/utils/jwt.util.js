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
    const payload =
      typeof data === "string" ? { email: data } : { ...data };
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
}

export const jwt = new JWT();
