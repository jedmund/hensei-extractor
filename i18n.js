/**
 * @fileoverview Internationalization module for the Chrome extension.
 * Provides translation functions with Japanese/English support.
 * Translations sourced from granblue.team frontend (montreal/messages/ja.json).
 */

// ==========================================
// STATE
// ==========================================

let currentLocale = 'en'

// ==========================================
// TRANSLATION STRINGS
// ==========================================

const strings = {
  // Navigation tabs
  nav_party:      { en: 'Party', ja: 'パーティ' },
  nav_collection: { en: 'Collection', ja: 'コレクション' },
  nav_database:   { en: 'Database', ja: 'データベース' },

  // Login / auth
  auth_title:          { en: 'granblue.team', ja: 'granblue.team' },
  auth_understand:     { en: 'I understand', ja: '了解しました' },
  auth_login:          { en: 'Log in', ja: 'ログイン' },
  auth_email:          { en: 'Email address', ja: 'メールアドレス' },
  auth_password:       { en: 'Password', ja: 'パスワード' },
  auth_no_account:     { en: "Don't have an account?", ja: 'アカウントをお持ちでない方は' },
  auth_create_account: { en: 'Create one', ja: '新規登録' },
  auth_logging_in:     { en: 'Logging in...', ja: 'ログイン中...' },
  auth_login_success:  { en: 'Login successful!', ja: 'ログインしました' },
  auth_login_failed:   { en: 'Login failed', ja: 'ログインに失敗しました' },
  auth_enter_credentials: { en: 'Please enter username and password', ja: 'メールアドレスとパスワードを入力してください' },

  // Warning / disclaimer
  warning_p1: {
    en: 'This extension only reads data your browser has already received. It does NOT make additional requests to GBF servers or modify game behavior.',
    ja: 'この拡張機能はブラウザが既に受信したデータのみを読み取ります。GBFサーバーへの追加リクエストやゲーム動作の変更は行いません。'
  },
  warning_p2: {
    en: 'While this is the safest approach, third-party tools are technically against Terms of Service. Use at your own risk.',
    ja: '最も安全なアプローチですが、サードパーティツールは厳密には利用規約に反します。ご自身の判断でご利用ください。'
  },
  warning_p3: {
    en: 'granblue.team assumes no responsibility for any account suspensions or bans that may result from its use.',
    ja: 'granblue.teamは使用に起因するアカウント停止やBANについて一切の責任を負いません。'
  },

  // Profile popover
  profile_logged_in_as:     { en: 'Logged in as', ja: 'ログイン中' },
  profile_language:          { en: 'Language', ja: '言語' },
  profile_clear_cache:      { en: 'Clear captured data', ja: 'キャプチャデータを削除' },
  profile_show_disclaimer:  { en: 'Show extension disclaimer', ja: '拡張機能の免責事項を表示' },
  profile_logout:           { en: 'Log out', ja: 'ログアウト' },

  // Detail view actions
  action_back:        { en: 'Back', ja: '戻る' },
  action_copy:        { en: 'Copy', ja: 'コピー' },
  action_save:        { en: 'Save', ja: '保存' },
  action_import:      { en: 'Import', ja: 'インポート' },
  action_importing:   { en: 'Importing...', ja: 'インポート中...' },
  action_imported:    { en: 'Imported', ja: 'インポート済み' },
  action_full_sync:   { en: 'Full Sync', ja: 'フルシンク' },
  action_syncing:     { en: 'Syncing...', ja: 'シンク中...' },
  action_synced:      { en: 'Synced', ja: 'シンク済み' },
  action_checking:    { en: 'Checking...', ja: '確認中...' },
  action_review:      { en: 'Review', ja: '確認' },
  action_reviewed:    { en: 'Reviewed', ja: '確認済み' },
  action_done:        { en: 'Done', ja: '完了' },
  action_create:      { en: 'Create', ja: '作成' },
  action_creating:    { en: 'Creating...', ja: '作成中...' },
  action_cancel:      { en: 'Cancel', ja: 'キャンセル' },
  action_sync:        { en: 'Sync', ja: 'シンク' },

  // Filter labels
  filter_ssr:             { en: 'SSR', ja: 'SSR' },
  filter_sr:              { en: 'SR', ja: 'SR' },
  filter_r:               { en: 'R', ja: 'R' },
  filter_exclude_lv1:     { en: 'Exclude Lv1', ja: 'Lv1を除外' },
  filter_enable_sync:     { en: 'Enable Full Sync', ja: 'フルシンクを有効にする' },
  filter_options:         { en: 'Options', ja: 'オプション' },
  filter_default:         { en: 'Filter', ja: 'フィルター' },

  // Empty states
  empty_party:      { en: 'Browse a party in game to capture data', ja: 'ゲーム内で編成を閲覧するとデータがキャプチャされます' },
  empty_collection: { en: 'Browse your collection pages to capture data', ja: 'コレクションページを閲覧するとデータがキャプチャされます' },
  empty_database:   { en: 'Browse detail pages to capture data', ja: '詳細ページを閲覧するとデータがキャプチャされます' },
  empty_no_data:    { en: 'No data available', ja: 'データがありません' },

  // Cache status
  cache_no_data:  { en: 'No data', ja: 'データなし' },
  cache_stale:    { en: 'Stale', ja: '期限切れ' },
  cache_cleared:  { en: 'Cache cleared', ja: 'キャッシュを削除しました' },

  // Time formatting
  time_seconds_ago: { en: '{count}s ago', ja: '{count}秒前' },
  time_minutes_ago: { en: '{count}m ago', ja: '{count}分前' },
  time_hours_ago:   { en: '{count}h ago', ja: '{count}時間前' },

  // Data types
  type_party:               { en: 'Party', ja: 'パーティ' },
  type_character:            { en: 'Character', ja: 'キャラクター' },
  type_weapon:               { en: 'Weapon', ja: '武器' },
  type_summon:               { en: 'Summon', ja: '召喚石' },
  type_character_list:       { en: 'Character List', ja: 'キャラクターリスト' },
  type_weapon_list:          { en: 'Weapon List', ja: '武器リスト' },
  type_summon_list:          { en: 'Summon List', ja: '召喚石リスト' },
  type_weapon_collection:    { en: 'Weapon Collection', ja: '武器コレクション' },
  type_character_collection: { en: 'Character Collection', ja: 'キャラクターコレクション' },
  type_summon_collection:    { en: 'Summon Collection', ja: '召喚石コレクション' },
  type_artifact_collection:  { en: 'Artifact Collection', ja: 'アーティファクトコレクション' },
  type_character_stats:      { en: 'Character Stats', ja: 'キャラクターステータス' },
  type_weapon_stash:         { en: 'Weapon Stash', ja: '武器倉庫' },
  type_summon_stash:         { en: 'Summon Stash', ja: '召喚石倉庫' },

  // Party sections
  party_section_job:         { en: 'Job', ja: 'ジョブ' },
  party_section_characters:  { en: 'Characters', ja: 'キャラクター' },
  party_section_weapons:     { en: 'Weapons', ja: '武器' },
  party_section_summons:     { en: 'Summons', ja: '召喚石' },
  party_section_accessories: { en: 'Accessories', ja: 'アクセサリー' },
  party_section_bullets:     { en: 'Bullets', ja: 'バレット' },
  party_no_data:             { en: 'No party data', ja: 'パーティデータがありません' },

  // Detail stats
  stat_name:        { en: 'Name', ja: '名前' },
  stat_id:          { en: 'ID', ja: 'ID' },
  stat_series:      { en: 'Series', ja: 'シリーズ' },
  stat_element:     { en: 'Element', ja: '属性' },
  stat_proficiency: { en: 'Proficiency', ja: '得意武器' },
  stat_uncap:       { en: 'Uncap', ja: '上限解放段階' },
  stat_min_hp:      { en: 'Min HP', ja: 'Min HP' },
  stat_max_hp:      { en: 'Max HP', ja: 'Max HP' },
  stat_min_atk:     { en: 'Min ATK', ja: 'Min ATK' },
  stat_max_atk:     { en: 'Max ATK', ja: 'Max ATK' },
  stat_max_level:   { en: 'Max Level', ja: '最大レベル' },
  stat_perpetuity_ring: { en: 'Perpetuity Ring', ja: '久遠の指輪' },
  stat_awakening:   { en: 'Awakening', ja: '覚醒' },
  stat_befoulment:  { en: 'Befoulment', ja: '魔蝕' },
  stat_exorcism:    { en: 'Exorcism', ja: '退魔' },
  stat_ax_skills:   { en: 'AX Skills', ja: 'EXスキル' },
  stat_sub_aura:    { en: 'Sub Aura', ja: 'サブ加護' },
  stat_quick_summon: { en: 'Quick Summon', ja: 'クイック召喚' },

  // Character stats view
  char_stats_no_captured: { en: 'No character stats captured', ja: 'キャラクターステータスがキャプチャされていません' },
  char_stats_no_stats:    { en: 'No stats captured', ja: 'ステータスがキャプチャされていません' },
  char_over_mastery:      { en: 'Over Mastery', ja: 'EXリミットボーナス' },
  char_aetherial_mastery: { en: 'Aetherial Mastery', ja: 'エーテリアルプラス' },
  char_perpetuity_bonuses: { en: 'Perpetuity Bonuses', ja: '久遠の指輪ボーナス' },

  // Raid picker
  raid_select:      { en: 'Select Raid', ja: 'クエストを選択' },
  raid_search:      { en: 'Search raids...', ja: 'クエストを検索...' },
  raid_refresh:     { en: 'Refresh raids', ja: 'クエストを更新' },
  raid_no_results:  { en: 'No raids found', ja: 'クエストが見つかりません' },
  raid_section_farming: { en: 'Farming', ja: '周回' },
  raid_section_raid:    { en: 'Raids', ja: 'マルチ' },
  raid_section_event:   { en: 'Events', ja: 'イベント' },
  raid_section_solo:    { en: 'Solo', ja: 'ソロ' },

  // Playlist picker
  playlist_label:          { en: 'Playlists', ja: 'プレイリスト' },
  playlist_select:         { en: 'Select Playlists', ja: 'プレイリストを選択' },
  playlist_search:         { en: 'Search playlists...', ja: 'プレイリストを検索...' },
  playlist_title_field:    { en: 'Playlist title', ja: 'プレイリストタイトル' },
  playlist_desc_field:     { en: 'Description (optional)', ja: '説明（任意）' },
  playlist_private:        { en: 'Private', ja: 'プライベート' },
  playlist_unlisted:       { en: 'Unlisted', ja: '限定公開' },
  playlist_public:         { en: 'Public', ja: '公開' },
  playlist_no_playlists:   { en: 'No playlists yet. Create one!', ja: 'プレイリストがまだありません。作成しましょう！' },
  playlist_no_results:     { en: 'No playlists found', ja: 'プレイリストが見つかりません' },
  playlist_title_required: { en: 'Title is required', ja: 'タイトルは必須です' },
  playlist_untitled:       { en: 'Untitled', ja: '無題' },

  // Plurals
  count_characters:       { en: '{count} characters', ja: '{count}キャラクター' },
  count_items:            { en: '{count} items', ja: '{count}アイテム' },
  count_pages:            { en: '{count} pages', ja: '{count}ページ' },
  count_playlists:        { en: '{count} playlists selected', ja: '{count}件のプレイリストを選択中' },
  count_selected:         { en: '{selected}/{total} selected', ja: '{selected}/{total} 選択中' },
  count_party:            { en: '{count} party', ja: '{count}編成' },
  count_parties:          { en: '{count} parties', ja: '{count}編成' },
  count_items_pages:      { en: '{items} items · {pages} pages', ja: '{items}アイテム · {pages}ページ' },
  count_bullets:          { en: '{count} Bullets', ja: '{count}バレット' },

  // Sync modal
  sync_modal_title:       { en: 'Full Sync', ja: 'フルシンク' },
  sync_modal_body:        { en: 'This will sync your entire collection with granblue.team.', ja: 'コレクション全体をgranblue.teamと同期します。' },
  sync_modal_warning:     { en: 'Items removed from your collection will cause any teams using them to show as "orphaned".', ja: 'コレクションから削除されたアイテムは、それを使用している編成が「孤立」として表示されるようになります。' },
  sync_no_deletions:      { en: 'No items will be removed.', ja: '削除されるアイテムはありません。' },
  sync_delete_count:      { en: '{count} item will be removed:', ja: '{count}件のアイテムが削除されます：' },
  sync_delete_count_plural: { en: '{count} items will be removed:', ja: '{count}件のアイテムが削除されます：' },
  sync_more_items:        { en: '...and {count} more', ja: '...他{count}件' },
  sync_result:            { en: 'Synced {total} items', ja: '{total}件をシンクしました' },
  sync_removed:           { en: ', removed {count}', ja: '、{count}件を削除' },
  sync_orphaned:          { en: ', {count} orphaned', ja: '、{count}件が孤立' },

  // Conflict modal
  conflict_modal_title:   { en: 'Review Items', ja: 'アイテムを確認' },
  conflict_modal_message: { en: 'This item has no tracking ID in your collection. Importing will update the existing entry.', ja: 'このアイテムにはコレクション内のトラッキングIDがありません。インポートすると既存のエントリが更新されます。' },
  conflict_skip:          { en: 'Skip', ja: 'スキップ' },
  conflict_skip_all:      { en: 'Skip All', ja: 'すべてスキップ' },
  conflict_import_all:    { en: 'Import All', ja: 'すべてインポート' },
  conflict_decided:       { en: '{count} / {total} decided', ja: '{count} / {total} 決定済み' },

  // Toast messages
  toast_copy_failed:        { en: 'Failed to copy', ja: 'コピーに失敗しました' },
  toast_copied:             { en: 'Copied to clipboard', ja: 'クリップボードにコピーしました' },
  toast_copied_items:       { en: 'Copied {count} items', ja: '{count}件をコピーしました' },
  toast_save_failed:        { en: 'Failed to save', ja: '保存に失敗しました' },
  toast_saved_file:         { en: 'Saved {filename}', ja: '{filename}を保存しました' },
  toast_import_failed:      { en: 'Import failed', ja: 'インポートに失敗しました' },
  toast_import_not_supported: { en: 'Import not supported', ja: 'インポートは対応していません' },
  toast_review_conflicts:   { en: 'Review conflicts before importing', ja: 'インポート前に競合を確認してください' },
  toast_opening_party:      { en: 'Opening party...', ja: 'パーティを開いています...' },
  toast_import_success:     { en: 'Import successful', ja: 'インポート成功' },
  toast_imported_items:     { en: 'Imported {total} items', ja: '{total}件をインポートしました' },
  toast_items_need_review:  { en: '{count} items need review', ja: '{count}件のアイテムの確認が必要です' },
  toast_item_needs_review:  { en: '{count} item needs review', ja: '{count}件のアイテムの確認が必要です' },
  toast_sync_failed:        { en: 'Sync failed: {error}', ja: 'シンク失敗: {error}' },
  toast_preview_failed:     { en: 'Preview failed: {error}', ja: 'プレビュー失敗: {error}' },
  toast_data_captured:      { en: '{name} data captured!', ja: '{name}のデータをキャプチャしました！' },

  // Update banner
  update_available:  { en: 'A new version is available (v', ja: '新しいバージョンがあります（v' },
  update_link:       { en: 'Update', ja: '更新' },

  // Party name
  party_name_placeholder: { en: 'Party name', ja: 'パーティ名' },

  // Mastery stat names
  mastery_atk:              { en: 'ATK', ja: '攻撃力' },
  mastery_hp:               { en: 'HP', ja: 'HP' },
  mastery_debuff_success:   { en: 'Debuff Success', ja: '弱体成功率' },
  mastery_skill_dmg_cap:    { en: 'Skill DMG Cap', ja: 'アビダメ上限' },
  mastery_ca_dmg:           { en: 'C.A. DMG', ja: '奥義ダメージ' },
  mastery_ca_dmg_cap:       { en: 'C.A. DMG Cap', ja: '奥義ダメ上限' },
  mastery_stamina:          { en: 'Stamina', ja: '渾身' },
  mastery_enmity:           { en: 'Enmity', ja: '背水' },
  mastery_critical_hit:     { en: 'Critical Hit', ja: 'クリティカル' },
  mastery_double_attack:    { en: 'Double Attack', ja: 'DA確率' },
  mastery_triple_attack:    { en: 'Triple Attack', ja: 'TA確率' },
  mastery_def:              { en: 'DEF', ja: '防御力' },
  mastery_healing:          { en: 'Healing', ja: '回復性能' },
  mastery_debuff_resistance: { en: 'Debuff Resistance', ja: '弱体耐性' },
  mastery_dodge:            { en: 'Dodge', ja: '回避率' },

  // Aetherial mastery stat names
  mastery_element_atk:        { en: 'Element ATK', ja: '属性攻撃' },
  mastery_element_resistance: { en: 'Element Resistance', ja: '属性耐性' },
  mastery_supplemental_dmg:   { en: 'Supplemental DMG', ja: '与ダメ加算' },
  mastery_counters_dodge:     { en: 'Counters on Dodge', ja: '回避カウンター' },
  mastery_counters_dmg:       { en: 'Counters on DMG', ja: '被ダメカウンター' },

  // Perpetuity stat names
  mastery_em_star_cap: { en: 'EM Star Cap', ja: 'EXリミット上限' },
  mastery_dmg_cap:     { en: 'DMG Cap', ja: 'ダメ上限' },

  // Elements
  element_fire:  { en: 'Fire', ja: '火' },
  element_water: { en: 'Water', ja: '水' },
  element_earth: { en: 'Earth', ja: '土' },
  element_wind:  { en: 'Wind', ja: '風' },
  element_light: { en: 'Light', ja: '光' },
  element_dark:  { en: 'Dark', ja: '闇' },

  // Proficiencies
  proficiency_sabre:  { en: 'Sabre', ja: '剣' },
  proficiency_dagger: { en: 'Dagger', ja: '短剣' },
  proficiency_axe:    { en: 'Axe', ja: '斧' },
  proficiency_spear:  { en: 'Spear', ja: '槍' },
  proficiency_bow:    { en: 'Bow', ja: '弓' },
  proficiency_staff:  { en: 'Staff', ja: '杖' },
  proficiency_melee:  { en: 'Melee', ja: '格闘' },
  proficiency_harp:   { en: 'Harp', ja: '楽器' },
  proficiency_gun:    { en: 'Gun', ja: '銃' },
  proficiency_katana: { en: 'Katana', ja: '刀' },

  // Weapon series
  series_seraphic:       { en: 'Seraphic', ja: 'セラフィック' },
  series_grand:          { en: 'Grand', ja: 'リミテッド' },
  series_dark_opus:      { en: 'Dark Opus', ja: '終末の神器' },
  series_revenant:       { en: 'Revenant', ja: '天星器' },
  series_primal:         { en: 'Primal', ja: 'マグナ' },
  series_beast:          { en: 'Beast', ja: '四象' },
  series_regalia:        { en: 'Regalia', ja: 'レガリア' },
  series_omega:          { en: 'Omega', ja: 'オメガ' },
  series_olden_primal:   { en: 'Olden Primal', ja: 'オールド・プライマル' },
  series_hollowsky:      { en: 'Hollowsky', ja: '虚空' },
  series_xeno:           { en: 'Xeno', ja: 'ゼノ' },
  series_rose:           { en: 'Rose', ja: 'ローズ' },
  series_ultima:         { en: 'Ultima', ja: 'アルティメット' },
  series_bahamut:        { en: 'Bahamut', ja: 'バハムート' },
  series_epic:           { en: 'Epic', ja: 'エピック' },
  series_cosmos:         { en: 'Cosmos', ja: 'コスミック' },
  series_superlative:    { en: 'Superlative', ja: 'スペリオル' },
  series_vintage:        { en: 'Vintage', ja: 'ヴィンテージ' },
  series_class_champion: { en: 'Class Champion', ja: 'クラス・チャンピオン' },
  series_replica:        { en: 'Replica', ja: 'レプリカ' },
  series_relic:          { en: 'Relic', ja: 'レリック' },
  series_rusted:         { en: 'Rusted', ja: '朽ちた' },
  series_sephira:        { en: 'Sephira', ja: 'セフィラ' },
  series_vyrmament:      { en: 'Vyrmament', ja: 'ヴァイラメント' },
  series_upgrader:       { en: 'Upgrader', ja: 'アップグレーダー' },
  series_astral:         { en: 'Astral', ja: 'アストラル' },
  series_draconic:       { en: 'Draconic', ja: 'ドラゴニック' },
  series_eternal_splendor: { en: 'Eternal Splendor', ja: 'エターナル・スプレンダー' },
  series_ancestral:      { en: 'Ancestral', ja: '六道' },
  series_new_world:      { en: 'New World Foundation', ja: 'ニューワールド' },
  series_ennead:         { en: 'Ennead', ja: 'エニアド' },
  series_militis:        { en: 'Militis', ja: 'ミリティス' },
  series_malice:         { en: 'Malice', ja: 'マリス' },
  series_menace:         { en: 'Menace', ja: 'メナス' },
  series_illustrious:    { en: 'Illustrious', ja: 'イラストリアス' },
  series_proven:         { en: 'Proven', ja: 'プロヴィングラウンド' },
  series_revans:         { en: 'Revans', ja: 'リヴァンス' },
  series_world:          { en: 'World', ja: 'ワールド' },
  series_exo:            { en: 'Exo', ja: 'エクソ' },
  series_draconic_providence: { en: 'Draconic Providence', ja: 'ドラコニック・プロヴィデンス' },
  series_celestial:      { en: 'Celestial', ja: 'セレスティアル' },
  series_omega_rebirth:  { en: 'Omega Rebirth', ja: 'オメガ・リバース' },
  series_collab:         { en: 'Collab', ja: 'コラボ' },
  series_destroyer:      { en: 'Destroyer', ja: 'デストロイヤー' },

  // Summon series
  series_providence:   { en: 'Providence', ja: 'プロヴィデンス' },
  series_genesis:      { en: 'Genesis', ja: 'ジェネシス' },
  series_magna:        { en: 'Magna', ja: 'マグナ' },
  series_optimus:      { en: 'Optimus', ja: 'オプティマス' },
  series_demi_optimus: { en: 'Demi Optimus', ja: 'デミ・オプティマス' },
  series_archangel:    { en: 'Archangel', ja: 'アークエンジェル' },
  series_arcarum:      { en: 'Arcarum', ja: 'アーカルム' },
  series_carbuncle:    { en: 'Carbuncle', ja: 'カーバンクル' },
  series_dynamis:      { en: 'Dynamis', ja: 'ダイナミス' },
  series_cryptid:      { en: 'Cryptid', ja: 'クリプティッド' },
  series_six_dragons:  { en: 'Six Dragons', ja: '六竜' },
  series_bellum:       { en: 'Bellum', ja: 'ベルム' },
  series_crest:        { en: 'Crest', ja: 'クレスト' },
  series_robur:        { en: 'Robur', ja: 'ロブル' },

  // Character series
  series_summer:    { en: 'Summer', ja: '水着' },
  series_yukata:    { en: 'Yukata', ja: '浴衣' },
  series_valentine: { en: 'Valentine', ja: 'バレンタイン' },
  series_halloween: { en: 'Halloween', ja: 'ハロウィン' },
  series_holiday:   { en: 'Holiday', ja: 'クリスマス' },
  series_zodiac:    { en: 'Zodiac', ja: '十二神将' },
  series_fantasy:   { en: 'Fantasy', ja: 'ファンタジー' },
  series_eternal:   { en: 'Eternal', ja: '十天衆' },
  series_evoker:    { en: 'Evoker', ja: '十賢者' },
  series_saint:     { en: 'Saint', ja: '六竜' },
  series_formal:    { en: 'Formal', ja: 'ドレスアップ' },

  // Awakening forms
  awakening_attack:        { en: 'Attack', ja: '攻撃' },
  awakening_defense:       { en: 'Defense', ja: '防御' },
  awakening_multiattack:   { en: 'Multiattack', ja: '連撃' },
  awakening_charge_attack: { en: 'Charge Attack', ja: '奥義' },
  awakening_skill:         { en: 'Skill', ja: 'アビリティ' },
  awakening_healing:       { en: 'Healing', ja: '回復' },
  awakening_special:       { en: 'Special', ja: '特殊' },

  // Language toggle
  lang_en: { en: 'EN', ja: 'EN' },
  lang_ja: { en: '日本語', ja: '日本語' },
}

// ==========================================
// SERIES NAME LOOKUP MAPS
// (keyed by English name → i18n key)
// ==========================================

const WEAPON_SERIES_I18N = {
  'Seraphic': 'series_seraphic', 'Grand': 'series_grand', 'Dark Opus': 'series_dark_opus',
  'Revenant': 'series_revenant', 'Primal': 'series_primal', 'Beast': 'series_beast',
  'Regalia': 'series_regalia', 'Omega': 'series_omega', 'Olden Primal': 'series_olden_primal',
  'Hollowsky': 'series_hollowsky', 'Xeno': 'series_xeno', 'Rose': 'series_rose',
  'Ultima': 'series_ultima', 'Bahamut': 'series_bahamut', 'Epic': 'series_epic',
  'Cosmos': 'series_cosmos', 'Superlative': 'series_superlative', 'Vintage': 'series_vintage',
  'Class Champion': 'series_class_champion', 'Replica': 'series_replica', 'Relic': 'series_relic',
  'Rusted': 'series_rusted', 'Sephira': 'series_sephira', 'Vyrmament': 'series_vyrmament',
  'Upgrader': 'series_upgrader', 'Astral': 'series_astral', 'Draconic': 'series_draconic',
  'Eternal Splendor': 'series_eternal_splendor', 'Ancestral': 'series_ancestral',
  'New World Foundation': 'series_new_world', 'Ennead': 'series_ennead', 'Militis': 'series_militis',
  'Malice': 'series_malice', 'Menace': 'series_menace', 'Illustrious': 'series_illustrious',
  'Proven': 'series_proven', 'Revans': 'series_revans', 'World': 'series_world',
  'Exo': 'series_exo', 'Draconic Providence': 'series_draconic_providence',
  'Celestial': 'series_celestial', 'Omega Rebirth': 'series_omega_rebirth',
  'Collab': 'series_collab', 'Destroyer': 'series_destroyer'
}

const SUMMON_SERIES_I18N = {
  'Providence': 'series_providence', 'Genesis': 'series_genesis', 'Magna': 'series_magna',
  'Optimus': 'series_optimus', 'Demi Optimus': 'series_demi_optimus', 'Archangel': 'series_archangel',
  'Arcarum': 'series_arcarum', 'Epic': 'series_epic', 'Carbuncle': 'series_carbuncle',
  'Dynamis': 'series_dynamis', 'Cryptid': 'series_cryptid', 'Six Dragons': 'series_six_dragons',
  'Summer': 'series_summer', 'Yukata': 'series_yukata', 'Holiday': 'series_holiday',
  'Collab': 'series_collab', 'Bellum': 'series_bellum', 'Crest': 'series_crest', 'Robur': 'series_robur'
}

const CHARACTER_SERIES_I18N = {
  'Summer': 'series_summer', 'Yukata': 'series_yukata', 'Valentine': 'series_valentine',
  'Halloween': 'series_halloween', 'Holiday': 'series_holiday', 'Zodiac': 'series_zodiac',
  'Grand': 'series_grand', 'Fantasy': 'series_fantasy', 'Collab': 'series_collab',
  'Eternal': 'series_eternal', 'Evoker': 'series_evoker', 'Saint': 'series_saint',
  'Formal': 'series_formal'
}

// ==========================================
// PUBLIC API
// ==========================================

/**
 * Set the active locale
 * @param {'en'|'ja'} lang
 */
export function setLocale(lang) {
  currentLocale = (lang === 'ja') ? 'ja' : 'en'
}

/**
 * Get the active locale
 * @returns {'en'|'ja'}
 */
export function getLocale() {
  return currentLocale
}

/**
 * Translate a key with optional parameter substitution
 * @param {string} key - Translation key
 * @param {Object} [params] - Parameters to substitute (e.g., { count: 5 })
 * @returns {string} Translated string, or English fallback, or key itself
 */
export function t(key, params) {
  const entry = strings[key]
  let str = entry?.[currentLocale] ?? entry?.en ?? key

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v)
    }
  }

  return str
}

/**
 * Translate a series name for display
 * @param {string} englishName - English series name from game-data.js
 * @param {'weapon'|'summon'|'character'} type - Entity type
 * @returns {string} Translated name
 */
export function translateSeries(englishName, type) {
  if (currentLocale === 'en') return englishName

  let map
  if (type === 'weapon') map = WEAPON_SERIES_I18N
  else if (type === 'summon') map = SUMMON_SERIES_I18N
  else if (type === 'character') map = CHARACTER_SERIES_I18N
  else return englishName

  const key = map[englishName]
  if (!key) return englishName

  return strings[key]?.ja ?? englishName
}

/**
 * Translate an element name for display
 * @param {string} englishName - English element name (e.g., 'Fire')
 * @returns {string} Translated name
 */
export function translateElement(englishName) {
  if (currentLocale === 'en') return englishName
  const key = `element_${englishName.toLowerCase()}`
  return strings[key]?.ja ?? englishName
}

/**
 * Translate a proficiency name for display
 * @param {string} englishName - English proficiency name (e.g., 'Sabre')
 * @returns {string} Translated name
 */
export function translateProficiency(englishName) {
  if (currentLocale === 'en') return englishName
  const key = `proficiency_${englishName.toLowerCase()}`
  return strings[key]?.ja ?? englishName
}

/**
 * Apply translations to all elements with data-i18n and data-i18n-placeholder attributes
 */
export function translatePage() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n
    const translated = t(key)
    if (translated !== key) {
      el.textContent = translated
    }
  })

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder
    const translated = t(key)
    if (translated !== key) {
      el.placeholder = translated
    }
  })

  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.dataset.i18nTitle
    const translated = t(key)
    if (translated !== key) {
      el.title = translated
    }
  })
}

/**
 * Get the preferred locale from auth or browser
 * @param {Object|null} gbAuth - Auth object with language field
 * @returns {'en'|'ja'}
 */
export function getPreferredLocale(gbAuth) {
  if (gbAuth?.language === 'ja') return 'ja'
  if (gbAuth?.language === 'en') return 'en'
  // Fallback to browser locale
  try {
    const uiLang = chrome.i18n?.getUILanguage?.() || navigator.language || 'en'
    return uiLang.startsWith('ja') ? 'ja' : 'en'
  } catch {
    return 'en'
  }
}
