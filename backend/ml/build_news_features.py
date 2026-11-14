import argparse
import json
from pathlib import Path
import pandas as pd
from ml.news_analysis import aggregate_news

def main():
    p=argparse.ArgumentParser(description='발행·공개 시점 제한과 유사 기사 제거 후 최근 7일 뉴스 피처 생성')
    p.add_argument('--input',type=Path,required=True)
    p.add_argument('--start',required=True)
    p.add_argument('--end',required=True)
    p.add_argument('--output',type=Path,required=True)
    args=p.parse_args()
    data=json.loads(args.input.read_text())
    articles=data if isinstance(data,list) else data['news']
    rows=[]
    for day in pd.date_range(args.start,args.end):
        for id,signals in aggregate_news(articles,str(day.date())).items():
            rows.append({'date':str(day.date()),'product_id':id,**signals})
    args.output.parent.mkdir(parents=True,exist_ok=True)
    pd.DataFrame(rows).to_csv(args.output,index=False)
    print(f'규칙 기반 뉴스 피처 {len(rows)}행 생성. 학습된 NLP 모델의 출력이 아닙니다.')

if __name__=='__main__':main()
