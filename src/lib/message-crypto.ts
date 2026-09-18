const encoder = new TextEncoder();
const decoder = new TextDecoder();
const keyName = "rally-message-private-key";
const toBase64 = (bytes: ArrayBufferLike | Uint8Array<ArrayBufferLike>) => {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return btoa(String.fromCharCode(...view));
};
const fromBase64 = (value: string) => Uint8Array.from(atob(value), char => char.charCodeAt(0));

async function keyPair() {
  const saved = localStorage.getItem(keyName);
  if (saved) {
    const keys = JSON.parse(saved) as { privateKey: JsonWebKey; publicKey: JsonWebKey };
    return { privateKey: await crypto.subtle.importKey("jwk", keys.privateKey, { name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]), publicKey: keys.publicKey };
  }
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]);
  const keys = { privateKey: await crypto.subtle.exportKey("jwk", pair.privateKey), publicKey: await crypto.subtle.exportKey("jwk", pair.publicKey) };
  localStorage.setItem(keyName, JSON.stringify(keys));
  return { privateKey: pair.privateKey, publicKey: keys.publicKey };
}
async function sharedKey(otherKey: string) {
  const mine = await keyPair();
  const publicKey = await crypto.subtle.importKey("jwk", JSON.parse(otherKey), { name: "ECDH", namedCurve: "P-256" }, false, []);
  return crypto.subtle.deriveKey({ name: "ECDH", public: publicKey }, mine.privateKey, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
export async function publishMessageKey(supabase: { from: (table: string) => { upsert: (values: object) => PromiseLike<{ error: unknown }> } }, userId: string) {
  const mine = await keyPair();
  const { error } = await supabase.from("friend_message_keys").upsert({ user_id: userId, public_key: JSON.stringify(mine.publicKey), updated_at: new Date().toISOString() });
  if (error) throw error;
}
export async function encryptMessage(body: string, receiverKey: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await sharedKey(receiverKey), encoder.encode(body));
  return { ciphertext: toBase64(ciphertext), iv: toBase64(iv) };
}
export async function decryptMessage(ciphertext: string, iv: string, senderKey: string) {
  const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv) }, await sharedKey(senderKey), fromBase64(ciphertext));
  return decoder.decode(clear);
}
