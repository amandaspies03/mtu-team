-- Score courses match the Match day page: Pistol EIC, Rifle EIC, Anti-Body Armor, Reflexive Fire.
delete from public.courses where code not in ('PISTOL_EIC','RIFLE_EIC','PISTOL_AB','RIFLE_RR');
update public.courses set name='Combat Pistol EIC (PI2210)', sort=1 where code='PISTOL_EIC';
update public.courses set name='Rifle EIC', sort=2 where code='RIFLE_EIC';
update public.courses set name='Pistol Anti-Body Armor (PI2250)', sort=3 where code='PISTOL_AB';
update public.courses set name='Rifle Reflexive Fire (RI3020)', sort=4 where code='RIFLE_RR';
