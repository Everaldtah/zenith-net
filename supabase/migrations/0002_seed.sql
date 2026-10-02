-- Launch catalog: the two games and their editions, plus the forum boards. Builds are added by scripts/publish.mjs.

insert into public.games (slug, name, tagline, description, genre, accent, site_url, sort) values
('zenith-umbra', 'ZENITH//UMBRA',
 'Anime hero shooter. Heroes against villains, piloted mechs, and a co-op war against colossi from space.',
 'Ten original heroes on two rival sides, each built to counter the other. Both tanks are piloted mechs whose pilots eject and fight on. '
 'Play online PvP where two players are enough and AI fills every other slot, or team up for Operation Starfall, a third-person co-op '
 'campaign of five levels against space colossi and the alien scientist Archon Qel''Varis.',
 'Hero Shooter', '#8b5cf6', 'https://zenith-umbra.vercel.app', 1),
('nebula-dominion', 'Nebula Dominion',
 'Real-time strategy between three alien powers, plus the Operation Iron Descent first-person co-op campaign.',
 'Build, expand and morph your main base through three tiers, then field giant tier-three units against the AI or watch AI fight AI. '
 'Operation Iron Descent takes the Directorate down to the surface of Vorrhaal in first person: three missions on foot, in a Juggernaut '
 'and in a Titan, alone or with a friend in online co-op.',
 'Real-Time Strategy', '#d946ef', 'https://nebula-dominion.vercel.app', 2);

insert into public.game_editions (game, edition, name, exe, detect, online, sort) values
('zenith-umbra', 'main', 'ZENITH//UMBRA', 'ZenithUmbra.exe',
 array['%LOCALAPPDATA%\Programs\ZenithUmbra', '%LOCALAPPDATA%\Programs\ZENITH UMBRA', '%LOCALAPPDATA%\Programs\zenith-umbra'], true, 1),
('nebula-dominion', 'rts', 'Nebula Dominion (RTS)', 'NebulaDominion.exe',
 array['%LOCALAPPDATA%\Programs\NebulaDominion', '%LOCALAPPDATA%\Programs\Nebula Dominion'], false, 1),
('nebula-dominion', 'iron-descent', 'Operation Iron Descent (FPS co-op)', 'IronDescent.exe',
 array['%LOCALAPPDATA%\Programs\IronDescent', '%LOCALAPPDATA%\Programs\Nebula Dominion - Iron Descent', '%LOCALAPPDATA%\Programs\iron-descent'], true, 2);

insert into public.forum_boards (id, game, name, description, kind, dev_only, sort) values
('zenith-news',      null, 'Zenith.net News',      'Announcements about Zenith.net, the launcher and new games.', 'news', true, 1),
('zenith-launcher',  null, 'Launcher Support',     'Problems installing, updating or signing in to the Zenith.net launcher.', 'help', false, 2),
('zenith-lfg',       null, 'Looking for Group',    'Find people to party up with in any Zenith.net game.', 'discussion', false, 3);

insert into public.forum_boards (id, game, name, description, kind, dev_only, sort)
select g.slug || '-' || b.suffix, g.slug, b.name, b.description, b.kind, b.dev_only, b.sort
from public.games g cross join (values
  ('news',        'News & Patch Notes',  'Updates and patch notes from the developer.', 'news', true, 1),
  ('general',     'General Discussion',  'Talk about anything to do with the game.', 'discussion', false, 2),
  ('bugs',        'Bug Reports',         'Something broken? Tell us what happened, what you expected and your game version. Every report is read.', 'bugs', false, 3),
  ('suggestions', 'Suggestions',         'Ideas for heroes, units, maps, modes and balance.', 'suggestions', false, 4),
  ('help',        'Technical Support',   'Crashes, performance, graphics and connection problems.', 'help', false, 5)
) as b(suffix, name, description, kind, dev_only, sort);
