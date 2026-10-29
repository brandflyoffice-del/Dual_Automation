UPDATE workflow_history h
SET nodes = replace(
  replace(
    h.nodes::text,
    $old$if (!region || !ctx.regionsSel.includes(region)) return;$old$,
    $new$const namedPlace = Array.isArray(ctx.places) && ctx.places.length > 0; if (!namedPlace && (!region || !ctx.regionsSel.includes(region))) return;$new$
  ),
  $old2$offering: String(body.offering || '').slice(0, 80),$old2$,
  $new2$offering: String(body.offering || '').slice(0, 80), places: placeList,$new2$
)::json
FROM workflow_published_version p
WHERE p."publishedVersionId" = h."versionId"
  AND h."workflowId" = 'fenebrisAutopilot01';

UPDATE workflow_entity
SET nodes = replace(
  replace(
    nodes::text,
    $old$if (!region || !ctx.regionsSel.includes(region)) return;$old$,
    $new$const namedPlace = Array.isArray(ctx.places) && ctx.places.length > 0; if (!namedPlace && (!region || !ctx.regionsSel.includes(region))) return;$new$
  ),
  $old2$offering: String(body.offering || '').slice(0, 80),$old2$,
  $new2$offering: String(body.offering || '').slice(0, 80), places: placeList,$new2$
)::json
WHERE id = 'fenebrisAutopilot01';

SELECT position('namedPlace' in nodes::text) > 0 AS place_ok
FROM workflow_history h
JOIN workflow_published_version p ON p."publishedVersionId" = h."versionId"
WHERE h."workflowId" = 'fenebrisAutopilot01';
