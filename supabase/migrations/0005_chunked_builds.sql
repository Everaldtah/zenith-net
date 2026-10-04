-- Chunked builds (Cloudflare R2) next to installer builds, and the Zenith Umbra Full / Lite editions.
--
-- kind = 'installer' (as before): url = NSIS installer, sha256/size = the installer's.
-- kind = 'chunked': url = the build's manifest on R2, sha256 = the manifest's, size = download size of a fresh install,
--                   install_size = bytes on disk. Only launchers that ask /api/catalog?chunked=1 are given these.

alter table public.game_builds
  add column kind text not null default 'installer' check (kind in ('installer', 'chunked')),
  add column install_size bigint check (install_size is null or install_size > 0);

-- one line under the edition picker: what this edition is, in the launcher and on the site
alter table public.game_editions add column note text not null default '';

-- the existing Electron game keeps its id ('main'), builds, installs and stats; only the title changes
update public.game_editions
   set name = 'Zenith Umbra Lite',
       note = 'The original edition: a small download that also runs in your browser. Online play and launcher parties.',
       sort = 2
 where game = 'zenith-umbra' and edition = 'main';

insert into public.game_editions (game, edition, name, exe, detect, online, sort, note) values
('zenith-umbra', 'full', 'Zenith Umbra Full Game Experience', 'Zenith Umbra Unity.exe', '{}', false, 1,
 'The full-quality edition with every asset at maximum quality. Updates only download what changed. Online play is not enabled in this edition yet: play it solo for now.');

update public.games
   set description = 'Ten original heroes on two rival sides, each built to counter the other. Both tanks are piloted mechs whose pilots eject and fight on. '
     || 'Zenith Umbra Full Game Experience is the full-quality edition of the game. Zenith Umbra Lite is the original edition: a small download with online PvP '
     || 'where two players are enough and AI fills every other slot, and Operation Starfall, a co-op campaign of five levels against space colossi.'
 where slug = 'zenith-umbra';
