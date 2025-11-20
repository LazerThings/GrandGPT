#!/usr/bin/env python3
"""
Admin script for managing extended access requests.

Usage:
    python manage_access.py list                  - List all pending requests
    python manage_access.py grant <username>      - Grant global extended access to a user
    python manage_access.py revoke <username>     - Revoke global extended access from a user
"""

import sys
import yaml
import os
from app import app, db
from models import User

EXTENDED_ACCESS_FILE = 'extended_access_requests.yaml'


def list_requests():
    """List all pending extended access requests."""
    if not os.path.exists(EXTENDED_ACCESS_FILE):
        print("No pending requests found.")
        return

    try:
        with open(EXTENDED_ACCESS_FILE, 'r') as f:
            requests = yaml.safe_load(f) or []

        if not requests:
            print("No pending requests found.")
            return

        print("\n=== Pending Extended Access Requests ===\n")
        for i, req in enumerate(requests, 1):
            print(f"{i}. Username: {req.get('username')}")
            print(f"   Display Name: {req.get('display_name', 'N/A')}")
            print(f"   Requested At: {req.get('requested_at', 'N/A')}")
            print()

    except Exception as e:
        print(f"Error reading requests file: {e}")


def grant_access(username):
    """Grant global extended access to a user."""
    with app.app_context():
        user = User.query.filter_by(username=username).first()

        if not user:
            print(f"Error: User '{username}' not found in database.")
            return

        # Add global extended access
        user.add_extended_access('global')
        db.session.commit()

        print(f"✓ Granted global extended access to user '{username}'")

        # Remove from pending requests if exists
        if os.path.exists(EXTENDED_ACCESS_FILE):
            try:
                with open(EXTENDED_ACCESS_FILE, 'r') as f:
                    requests = yaml.safe_load(f) or []

                # Filter out the granted user
                requests = [r for r in requests if r.get('username') != username]

                # Save updated requests
                with open(EXTENDED_ACCESS_FILE, 'w') as f:
                    yaml.dump(requests, f, default_flow_style=False)

                print(f"✓ Removed '{username}' from pending requests")
            except Exception as e:
                print(f"Warning: Could not update requests file: {e}")


def revoke_access(username):
    """Revoke global extended access from a user."""
    with app.app_context():
        user = User.query.filter_by(username=username).first()

        if not user:
            print(f"Error: User '{username}' not found in database.")
            return

        # Remove global extended access
        user.remove_extended_access('global')
        db.session.commit()

        print(f"✓ Revoked global extended access from user '{username}'")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1].lower()

    if command == 'list':
        list_requests()

    elif command == 'grant':
        if len(sys.argv) < 3:
            print("Error: Please provide a username to grant access to.")
            print("Usage: python manage_access.py grant <username>")
            sys.exit(1)

        username = sys.argv[2]
        grant_access(username)

    elif command == 'revoke':
        if len(sys.argv) < 3:
            print("Error: Please provide a username to revoke access from.")
            print("Usage: python manage_access.py revoke <username>")
            sys.exit(1)

        username = sys.argv[2]
        revoke_access(username)

    else:
        print(f"Error: Unknown command '{command}'")
        print(__doc__)
        sys.exit(1)


if __name__ == '__main__':
    main()
