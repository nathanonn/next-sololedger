#!/usr/bin/env python3
"""
Generate a secure base64-encoded 32-byte encryption key for APP_ENCRYPTION_KEY.

Usage:
    python generate_encryption_key.py

Outputs a base64-encoded 32-byte key suitable for AES-256-GCM encryption.
"""

import secrets
import base64


def generate_encryption_key() -> str:
    """
    Generate a cryptographically secure 32-byte encryption key.

    Returns:
        Base64-encoded 32-byte key
    """
    # Generate 32 random bytes (256 bits for AES-256)
    key_bytes = secrets.token_bytes(32)

    # Encode as base64 for storage in environment variables
    key_b64 = base64.b64encode(key_bytes).decode('utf-8')

    return key_b64


if __name__ == "__main__":
    key = generate_encryption_key()
    print("Generated APP_ENCRYPTION_KEY:")
    print(key)
    print("\nAdd this to your .env file:")
    print(f"APP_ENCRYPTION_KEY={key}")
