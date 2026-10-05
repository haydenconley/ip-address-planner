# Lab IP Address Manager

A small, dependency-free local web app for tracking home and lab IPv4 address ranges. Requires Node.js 20 or later.

## Run

```sh
node server.mjs
```

Open http://127.0.0.1:3210 in your browser. Stop with Ctrl+C. The server binds only to your computer's loopback interface. No cloud account or build step is needed.

## Use

Add a name, environment (such as Home or Lab), and a CIDR subnet (`192.168.1.0/24`) or inclusive address pool (`192.168.1.20 - 192.168.1.100`). Notes can hold VLAN, gateway, or DHCP information. Edit, delete, search, and filter ranges from the inventory.

The entire range must fit within one RFC 1918 block: `10.0.0.0/8`, `172.16.0.0/12`, or `192.168.0.0/16`. Non-network CIDR addresses are rejected with the correct network address suggested. Overlaps, including nested ranges, are rejected within the same environment (case-insensitive); independent environments may reuse addresses. Address counts include every address, including network and broadcast addresses where applicable, and do not represent device usage or usable host capacity. This is an inventory, not a network scanner or router configurator.

## Data and backups

Records are stored in `data/ranges.json`, excluded from Git. Stop the server before copying this file for backup or restoring it. Writes use a temporary file and atomic rename; invalid existing data stops startup rather than silently replacing the inventory. Run only one server per data directory. This single-user local app has no sign-in and must not be exposed through a public proxy.

Optional environment variables: `PORT` (default `3210`) and `LAB_IP_DATA_DIR` (default `data` beside the server).

## Validate

```sh
node --test
```

Tests cover private-space boundaries, invalid inputs, overlap detection, API operations, and persistence across restarts.
