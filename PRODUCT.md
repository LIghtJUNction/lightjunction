# Product

LightJunction brings its public profile, local command-line tools, and setup
helpers into one repository. The profile introduces the organizations the owner
contributes to and Project Z, a collection of small Rust libraries.

## Public profile

The website is authored in `index.html` and `site/profile.css`. Visitors can
follow organization and library links, read the English or Chinese introduction,
and find contact details without waiting for an animation or a remote data feed.
JavaScript adds language selection, email copying, and disclosure dismissal.

Public age and OpenPGP keys are available as downloads. The profile describes
local encryption; it does not collect messages or private keys. The existing
Challenge II artifact and original public section remain available at
`archive.html`.

## Local tools

The `cli/` crate provides public-key export and local age/OpenPGP encryption
commands. Its own README documents supported commands, installation, and timing
output. Root shell scripts and `lib/` provide separate machine setup helpers;
they are not website runtime code.

## Boundaries

Keep public claims tied to source, working behavior, or recorded measurements.
Do not add generated activity feeds, invented adoption statistics, credentials,
or private operational data. Preserve the Challenge II artifact and its public
clues during unrelated maintenance. See `CONTRIBUTING.md` for the current
repository map and local checks.
