import argparse
import json
from datetime import datetime,timezone
from pathlib import Path
from app.config import Settings
from app.providers.collectors import KamisClient,KosisClient,ConsoleURLClient

def main():
    parser=argparse.ArgumentParser(description='공식 API 원본 JSON 수집. 품목 정규화는 별도 단계입니다.')
    parser.add_argument('--source',choices=['kamis','ecos','kosis','weather','news'],required=True)
    parser.add_argument('--config',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    settings=Settings();config=json.loads(args.config.read_text())
    if args.source=='kamis':
        result=KamisClient(settings.kamis_cert_id,settings.kamis_cert_key).daily_retail(**config)
    elif args.source=='kosis':
        result=KosisClient(settings.kosis_api_key).statistics(**config)
    else:
        key={'ecos':settings.ecos_api_key,'weather':settings.weather_api_key,'news':settings.news_api_key}[args.source]
        result=ConsoleURLClient(args.source,key).collect(config)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps({'source':args.source,'collected_at':datetime.now(timezone.utc).isoformat(),'mode':'live_raw_unvalidated','response':result},ensure_ascii=False,indent=2))
    print(f'{args.source}: 원본 응답 저장 완료. 날짜·규격·등급·지역 및 공개 시점 검증이 필요합니다.')

if __name__=='__main__':main()
